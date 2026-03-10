// CadToolOnline - Geometry bindings for WASM
// Provides shape creation and management functions using OCCT

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <vector>
#include <sstream>
#include <streambuf>

#include "ShapeStore.h"
#include "../binding/shared.hpp"

// OCCT headers for shape creation
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <gp_Ax2.hxx>
#include <gp_Pnt.hxx>
#include <gp_Dir.hxx>

// T2.2: STEP file reading
#include <STEPControl_Reader.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <STEPCAFControl_Reader.hxx>
#include <XCAFDoc_DocumentTool.hxx>
#include <XCAFDoc_ShapeTool.hxx>
#include <XCAFDoc_ColorTool.hxx>
#include <TDocStd_Document.hxx>
#include <TDataStd_Name.hxx>
#include <TDF_Label.hxx>
#include <TDF_LabelSequence.hxx>
#include <TDF_ChildIterator.hxx>
#include <TCollection_AsciiString.hxx>
#include <TCollection_ExtendedString.hxx>
#include <XCAFDoc_Location.hxx>
#include <Quantity_Color.hxx>
#include <Quantity_ColorRGBA.hxx>

// T2.3: Mesh generation
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRepBndLib.hxx>
#include <BRepLib_ToolTriangulatedShape.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Edge.hxx>
#include <BRep_Tool.hxx>
#include <Poly_Triangulation.hxx>
#include <Bnd_Box.hxx>
#include <TopLoc_Location.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>
#include <BRepAdaptor_Curve.hxx>
#include <GCPnts_AbscissaPoint.hxx>
#include <GeomAbs_CurveType.hxx>
#include <Geom_Curve.hxx>

// T2.4: Mass properties
#include <GProp_GProps.hxx>
#include <BRepGProp.hxx>

// T2.5: Face normal calculation for marker creation
#include <BRepIntCurveSurface_Inter.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepLProp_SLProps.hxx>
#include <IntCurveSurface_IntersectionPoint.hxx>
#include <ElCLib.hxx>
#include <gp_Lin.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Sphere.hxx>
#include <Precision.hxx>

// For random color generation
#include <cmath>
#include <algorithm>
#include <cctype>
#include <locale>
#include <codecvt>

using namespace emscripten;

namespace {

class VectorBuffer : public std::streambuf {
public:
    explicit VectorBuffer(const std::vector<uint8_t>& data)
    {
        auto* begin = const_cast<char*>(reinterpret_cast<const char*>(data.data()));
        auto* end = begin + static_cast<std::ptrdiff_t>(data.size());
        setg(begin, begin, end);
    }
};

double resolveLinearDeflection(const TopoDS_Shape& shape, double linearDeflection)
{
    if (linearDeflection <= 0.0) {
        return 0.1;
    }

    // Treat small values as relative sag and scale by average bounding-box size.
    if (linearDeflection <= 0.01) {
        Bnd_Box boundingBox;
        BRepBndLib::Add(shape, boundingBox, false);
        if (!boundingBox.IsVoid()) {
            Standard_Real xMin, yMin, zMin, xMax, yMax, zMax;
            boundingBox.Get(xMin, yMin, zMin, xMax, yMax, zMax);
            const Standard_Real avgSize = ((xMax - xMin) + (yMax - yMin) + (zMax - zMin)) / 3.0;
            const double scaled = static_cast<double>(avgSize) * linearDeflection;
            if (scaled > Precision::Confusion()) {
                return scaled;
            }
        }
    }

    // Treat larger values as absolute linear deflection.
    return linearDeflection;
}

void appendFallbackNormals(const Handle(Poly_Triangulation)& triangulation,
                           const gp_Trsf& transform,
                           bool reversed,
                           std::vector<double>& normals)
{
    gp_Vec normalVec(0.0, 0.0, 1.0);
    bool found = false;

    const int nbTriangles = triangulation->NbTriangles();
    for (int i = 1; i <= nbTriangles; ++i) {
        Poly_Triangle tri = triangulation->Triangle(i);
        int n1, n2, n3;
        tri.Get(n1, n2, n3);
        gp_Pnt p1 = triangulation->Node(n1).Transformed(transform);
        gp_Pnt p2 = triangulation->Node(n2).Transformed(transform);
        gp_Pnt p3 = triangulation->Node(n3).Transformed(transform);
        gp_Vec v12(p1, p2);
        gp_Vec v13(p1, p3);
        gp_Vec cross = v12.Crossed(v13);
        if (cross.Magnitude() > Precision::Confusion()) {
            normalVec = cross.Normalized();
            found = true;
            break;
        }
    }

    if (!found) {
        normalVec = gp_Vec(0.0, 0.0, 1.0);
    }
    if (reversed) {
        normalVec.Reverse();
    }

    const int nbNodes = triangulation->NbNodes();
    for (int i = 0; i < nbNodes; ++i) {
        normals.push_back(normalVec.X());
        normals.push_back(normalVec.Y());
        normals.push_back(normalVec.Z());
    }
}

// ============================================================================
// Part Name Counter - 用于无效名称的回退命名
// ============================================================================

class PartNameCounter {
private:
    int partIndex = 0;

public:
    std::string getNextPartName() {
        partIndex++;
        return "Part" + std::to_string(partIndex);
    }

    void reset() {
        partIndex = 0;
    }
};

// 全局零件名计数器实例
static PartNameCounter g_partNameCounter;

// ============================================================================
// Smart Color Generator - 使用黄金角分割生成视觉上协调的颜色
// ============================================================================

class SmartColorGenerator {
private:
    int colorIndex = 0;
    static constexpr double GOLDEN_RATIO_CONJUGATE = 0.618033988749895;
    static constexpr double DEFAULT_SATURATION = 0.75;  // 饱和度
    static constexpr double DEFAULT_VALUE = 0.90;       // 明度

    // HSV 转 RGB
    static void hsvToRgb(double h, double s, double v, int& r, int& g, int& b) {
        double c = v * s;
        double x = c * (1.0 - std::abs(std::fmod(h * 6.0, 2.0) - 1.0));
        double m = v - c;

        double r1, g1, b1;

        if (h < 1.0/6.0) {
            r1 = c; g1 = x; b1 = 0;
        } else if (h < 2.0/6.0) {
            r1 = x; g1 = c; b1 = 0;
        } else if (h < 3.0/6.0) {
            r1 = 0; g1 = c; b1 = x;
        } else if (h < 4.0/6.0) {
            r1 = 0; g1 = x; b1 = c;
        } else if (h < 5.0/6.0) {
            r1 = x; g1 = 0; b1 = c;
        } else {
            r1 = c; g1 = 0; b1 = x;
        }

        r = static_cast<int>((r1 + m) * 255.0);
        g = static_cast<int>((g1 + m) * 255.0);
        b = static_cast<int>((b1 + m) * 255.0);

        // 确保在有效范围内
        r = std::max(0, std::min(255, r));
        g = std::max(0, std::min(255, g));
        b = std::max(0, std::min(255, b));
    }

public:
    // 获取下一个颜色（使用黄金角分割确保颜色均匀分布）
    std::string getNextColor() {
        // 使用黄金角分割生成色相
        double hue = std::fmod(colorIndex * GOLDEN_RATIO_CONJUGATE, 1.0);

        // 轻微变化饱和度和明度以增加多样性
        double saturation = DEFAULT_SATURATION + (std::fmod(colorIndex * 0.123, 0.2) - 0.1);
        double value = DEFAULT_VALUE + (std::fmod(colorIndex * 0.456, 0.15) - 0.075);

        // 确保在合理范围内
        saturation = std::max(0.6, std::min(0.95, saturation));
        value = std::max(0.75, std::min(0.98, value));

        int r, g, b;
        hsvToRgb(hue, saturation, value, r, g, b);

        char hexColor[8];
        snprintf(hexColor, sizeof(hexColor), "#%02X%02X%02X", r, g, b);

        colorIndex++;
        return std::string(hexColor);
    }

    // 重置颜色索引（用于新的 STEP 文件）
    void reset() {
        colorIndex = 0;
    }
};

// 全局颜色生成器实例
static SmartColorGenerator g_colorGenerator;

// Create a box and store it
std::string makeBox(double dx, double dy, double dz, const std::string& id) {
    try {
        BRepPrimAPI_MakeBox maker(dx, dy, dz);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a box at a specific position
std::string makeBoxAt(double x, double y, double z, double dx, double dy, double dz, const std::string& id) {
    try {
        gp_Pnt origin(x, y, z);
        BRepPrimAPI_MakeBox maker(origin, dx, dy, dz);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a cylinder along Z axis
std::string makeCylinder(double radius, double height, const std::string& id) {
    try {
        BRepPrimAPI_MakeCylinder maker(radius, height);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a cylinder at a specific position and direction
std::string makeCylinderAt(double x, double y, double z,
                           double dirX, double dirY, double dirZ,
                           double radius, double height, const std::string& id) {
    try {
        gp_Pnt origin(x, y, z);
        gp_Dir direction(dirX, dirY, dirZ);
        gp_Ax2 axis(origin, direction);
        BRepPrimAPI_MakeCylinder maker(axis, radius, height);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a sphere
std::string makeSphere(double radius, const std::string& id) {
    try {
        BRepPrimAPI_MakeSphere maker(radius);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a sphere at a specific position
std::string makeSphereAt(double x, double y, double z, double radius, const std::string& id) {
    try {
        gp_Pnt center(x, y, z);
        BRepPrimAPI_MakeSphere maker(center, radius);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Create a cone
std::string makeCone(double radius1, double radius2, double height, const std::string& id) {
    try {
        BRepPrimAPI_MakeCone maker(radius1, radius2, height);
        maker.Build();
        if (maker.IsDone()) {
            geo::ShapeStore::instance().addShape(id, maker.Shape());
            return id;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Boolean union of two shapes
std::string booleanFuse(const std::string& id1, const std::string& id2, const std::string& resultId) {
    auto& store = geo::ShapeStore::instance();
    auto shape1 = store.getShape(id1);
    auto shape2 = store.getShape(id2);

    if (!shape1.has_value() || !shape2.has_value()) {
        return "";
    }

    try {
        BRepAlgoAPI_Fuse fuse(shape1.value(), shape2.value());
        fuse.Build();
        if (fuse.IsDone()) {
            store.addShape(resultId, fuse.Shape());
            return resultId;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Boolean subtraction
std::string booleanCut(const std::string& id1, const std::string& id2, const std::string& resultId) {
    auto& store = geo::ShapeStore::instance();
    auto shape1 = store.getShape(id1);
    auto shape2 = store.getShape(id2);

    if (!shape1.has_value() || !shape2.has_value()) {
        return "";
    }

    try {
        BRepAlgoAPI_Cut cut(shape1.value(), shape2.value());
        cut.Build();
        if (cut.IsDone()) {
            store.addShape(resultId, cut.Shape());
            return resultId;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Boolean intersection
std::string booleanCommon(const std::string& id1, const std::string& id2, const std::string& resultId) {
    auto& store = geo::ShapeStore::instance();
    auto shape1 = store.getShape(id1);
    auto shape2 = store.getShape(id2);

    if (!shape1.has_value() || !shape2.has_value()) {
        return "";
    }

    try {
        BRepAlgoAPI_Common common(shape1.value(), shape2.value());
        common.Build();
        if (common.IsDone()) {
            store.addShape(resultId, common.Shape());
            return resultId;
        }
    } catch (...) {
        // Fall through to return empty
    }
    return "";
}

// Remove a shape from the store
void removeShape(const std::string& id) {
    geo::ShapeStore::instance().removeShape(id);
}

// Check if a shape exists
bool hasShape(const std::string& id) {
    return geo::ShapeStore::instance().hasShape(id);
}

// Clear all shapes
void clearShapes() {
    geo::ShapeStore::instance().clear();
}

// Get number of shapes
int getShapeCount() {
    return static_cast<int>(geo::ShapeStore::instance().size());
}

// ============================================================================
// T2.2: STEP File Reading with Hierarchy Support
// ============================================================================

// Helper function to convert ExtendedString to UTF-8
std::string extendedStringToUtf8(const TCollection_ExtendedString& extStr) {
    if (extStr.IsEmpty()) {
        return "";
    }

    try {
        // Convert ExtendedString to UTF-8
        std::string utf8Result;
        const Standard_ExtString extChars = extStr.ToExtString();

        for (int i = 0; i < extStr.Length(); ++i) {
            Standard_ExtCharacter extChar = extChars[i];

            if (extChar < 0x80) {
                // ASCII character (1 byte)
                utf8Result += static_cast<char>(extChar);
            } else if (extChar < 0x800) {
                // 2-byte UTF-8
                utf8Result += static_cast<char>(0xC0 | (extChar >> 6));
                utf8Result += static_cast<char>(0x80 | (extChar & 0x3F));
            } else {
                // 3-byte UTF-8
                utf8Result += static_cast<char>(0xE0 | (extChar >> 12));
                utf8Result += static_cast<char>(0x80 | ((extChar >> 6) & 0x3F));
                utf8Result += static_cast<char>(0x80 | (extChar & 0x3F));
            }
        }

        return utf8Result;
    } catch (...) {
        return "";
    }
}

std::string trimAsciiWhitespace(const std::string& value) {
    auto begin = value.begin();
    while (begin != value.end() && std::isspace(static_cast<unsigned char>(*begin))) {
        ++begin;
    }

    auto end = value.end();
    while (end != begin && std::isspace(static_cast<unsigned char>(*(end - 1)))) {
        --end;
    }

    return std::string(begin, end);
}

bool isValidPartName(const std::string& name);

bool isPlaceholderOccurrenceName(const std::string& name) {
    const std::string trimmed = trimAsciiWhitespace(name);
    if (trimmed.empty() || trimmed == "NONE" || trimmed == "Unknown" || trimmed == "未知") {
        return true;
    }

    if (trimmed.size() <= 4 || trimmed.rfind("NAUO", 0) != 0) {
        return false;
    }

    return std::all_of(trimmed.begin() + 4, trimmed.end(), [](unsigned char c) {
        return std::isdigit(c) != 0;
    });
}

std::string extractLabelName(const TDF_Label& label) {
    Handle(TDataStd_Name) nameAttr;
    if (!label.FindAttribute(TDataStd_Name::GetID(), nameAttr)) {
        return "";
    }

    return trimAsciiWhitespace(extendedStringToUtf8(nameAttr->Get()));
}

std::string resolveNodeName(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label) {
    const std::string labelName = extractLabelName(label);
    const bool labelNameUsable = isValidPartName(labelName) && !isPlaceholderOccurrenceName(labelName);

    if (shapeTool->IsReference(label)) {
        TDF_Label referred;
        if (shapeTool->GetReferredShape(label, referred)) {
            const std::string referredName = extractLabelName(referred);
            const bool referredNameUsable = isValidPartName(referredName) && !isPlaceholderOccurrenceName(referredName);

            if (referredNameUsable) {
                return referredName;
            }
        }
    }

    if (labelNameUsable) {
        return labelName;
    }

    if (isValidPartName(labelName)) {
        return labelName;
    }

    return g_partNameCounter.getNextPartName();
}

bool resolveReferenceTarget(const Handle(XCAFDoc_ShapeTool)& shapeTool,
                            const TDF_Label& label,
                            TDF_Label& resolvedLabel) {
    if (shapeTool->IsReference(label) && shapeTool->GetReferredShape(label, resolvedLabel)) {
        return true;
    }

    resolvedLabel = label;
    return !resolvedLabel.IsNull();
}

bool isAssemblyNode(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label) {
    if (shapeTool->IsAssembly(label)) {
        return true;
    }

    TDF_Label resolved;
    if (resolveReferenceTarget(shapeTool, label, resolved) && resolved != label) {
        return shapeTool->IsAssembly(resolved);
    }

    return false;
}

bool isSimpleShapeNode(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label) {
    if (shapeTool->IsSimpleShape(label)) {
        return true;
    }

    TDF_Label resolved;
    if (resolveReferenceTarget(shapeTool, label, resolved) && resolved != label) {
        return shapeTool->IsSimpleShape(resolved);
    }

    return false;
}

std::vector<TDF_Label> collectChildShapeLabels(const Handle(XCAFDoc_ShapeTool)& shapeTool,
                                               const TDF_Label& label) {
    std::vector<TDF_Label> children;
    TDF_LabelSequence components;
    shapeTool->GetComponents(label, components, Standard_False);

    if (components.Length() == 0) {
        TDF_Label resolved;
        if (resolveReferenceTarget(shapeTool, label, resolved) && resolved != label) {
            shapeTool->GetComponents(resolved, components, Standard_False);
        }
    }

    for (int i = 1; i <= components.Length(); ++i) {
        children.push_back(components.Value(i));
    }

    if (!children.empty()) {
        return children;
    }

    TDF_ChildIterator it(label);
    for (; it.More(); it.Next()) {
        if (shapeTool->IsShape(it.Value())) {
            children.push_back(it.Value());
        }
    }

    return children;
}

// Helper function to check if a string is valid (not garbled)
bool isValidPartName(const std::string& name) {
    if (name.empty() || name == "Unnamed") {
        return false;
    }

    // Check for common garbled patterns
    // If the string contains mostly control characters or unprintable chars, it's likely garbled
    int printableCount = 0;
    int totalCount = 0;

    for (unsigned char c : name) {
        totalCount++;
        // Consider ASCII printable chars and UTF-8 continuation bytes as valid
        if ((c >= 32 && c <= 126) || (c >= 0x80)) {
            printableCount++;
        }
    }

    // If less than 80% of characters are printable, consider it garbled
    return totalCount > 0 && (printableCount * 100 / totalCount >= 80);
}

// Helper function to escape JSON strings
std::string escapeJsonString(const std::string& input) {
    std::string output;
    for (unsigned char c : input) {
        switch (c) {
            case '"': output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\b': output += "\\b"; break;
            case '\f': output += "\\f"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                // Keep UTF-8 bytes as-is
                output += c;
                break;
        }
    }
    return output;
}

bool tryGetColorFromLabel(const Handle(XCAFDoc_ColorTool)& colorTool,
                          const TDF_Label& label,
                          Quantity_Color& color)
{
    return colorTool->GetColor(label, XCAFDoc_ColorSurf, color)
        || colorTool->GetColor(label, XCAFDoc_ColorGen, color)
        || colorTool->GetColor(label, XCAFDoc_ColorCurv, color);
}

bool tryResolveNodeColor(const Handle(XCAFDoc_ShapeTool)& shapeTool,
                         const Handle(XCAFDoc_ColorTool)& colorTool,
                         const TDF_Label& label,
                         Quantity_Color& color)
{
    // 1) Direct color on current label.
    if (tryGetColorFromLabel(colorTool, label, color)) {
        return true;
    }

    // 2) If current label is a reference, try its referred shape label.
    if (shapeTool->IsReference(label)) {
        TDF_Label referred;
        if (shapeTool->GetReferredShape(label, referred)) {
            if (tryGetColorFromLabel(colorTool, referred, color)) {
                return true;
            }
        }
    }

    // 3) Try color bound directly on shape.
    TopoDS_Shape shape = shapeTool->GetShape(label);
    if (!shape.IsNull()) {
        if (colorTool->GetColor(shape, XCAFDoc_ColorSurf, color)
            || colorTool->GetColor(shape, XCAFDoc_ColorGen, color)
            || colorTool->GetColor(shape, XCAFDoc_ColorCurv, color)) {
            return true;
        }
    }

    // 4) Inherit from parent labels.
    TDF_Label parent = label.Father();
    while (!parent.IsNull()) {
        if (tryGetColorFromLabel(colorTool, parent, color)) {
            return true;
        }

        const TDF_Label nextParent = parent.Father();
        if (nextParent == parent) {
            break;
        }
        parent = nextParent;
    }

    return false;
}

std::string toHexColor(const Quantity_Color& color)
{
    int r = static_cast<int>(color.Red() * 255.0);
    int g = static_cast<int>(color.Green() * 255.0);
    int b = static_cast<int>(color.Blue() * 255.0);

    char hexColor[8];
    snprintf(hexColor, sizeof(hexColor), "#%02X%02X%02X", r, g, b);
    return std::string(hexColor);
}

// Helper function to recursively build hierarchy JSON
void buildHierarchyJson(const Handle(XCAFDoc_ShapeTool)& shapeTool,
                        const Handle(XCAFDoc_ColorTool)& colorTool,
                        const TDF_Label& label,
                        const std::string& baseId,
                        int& counter,
                        std::stringstream& result,
                        geo::ShapeStore& store) {
    const std::string name = resolveNodeName(shapeTool, label);

    // Determine node type
    const bool isAssembly = isAssemblyNode(shapeTool, label);
    const bool isSimpleShape = isSimpleShapeNode(shapeTool, label);

    std::string nodeType = isAssembly ? "assembly" : (isSimpleShape ? "solid" : "part");
    std::string nodeId = baseId + "_node_" + std::to_string(++counter);

    result << "{\"id\":\"" << nodeId << "\"";
    result << ",\"name\":\"" << escapeJsonString(name) << "\"";
    result << ",\"type\":\"" << nodeType << "\"";

    // Extract color information
    Quantity_Color color;
    bool hasColor = false;

    hasColor = tryResolveNodeColor(shapeTool, colorTool, label, color);

    // Output color as hex RGB
    if (hasColor) {
        result << ",\"color\":\"" << toHexColor(color) << "\"";
    } else {
        // Deterministic fallback colors avoid random "rainbow" appearance.
        if (isSimpleShape || (!isAssembly && nodeType == "part")) {
            result << ",\"color\":\"#D4A017\"";
        } else {
            // Assemblies get a neutral gray
            result << ",\"color\":\"#C0C0C0\"";
        }
    }

    // Store the underlying definition shape for renderable nodes.
    // Instance/reference transforms are emitted separately in node.transform and
    // composed on the webview side to preserve nested assembly placement.
    if (isSimpleShape || !isAssembly) {
        TDF_Label shapeLabel = label;
        resolveReferenceTarget(shapeTool, label, shapeLabel);
        TopoDS_Shape shape = shapeTool->GetShape(shapeLabel);
        if (!shape.IsNull()) {
            std::string shapeId = nodeId + "_shape";
            store.addShape(shapeId, shape);
            result << ",\"shapeId\":\"" << shapeId << "\"";
        }
    }

    // Get location/transform
    TopLoc_Location loc = shapeTool->GetLocation(label);
    if (!loc.IsIdentity()) {
        gp_Trsf trsf = loc.Transformation();
        gp_XYZ trans = trsf.TranslationPart();

        result << ",\"transform\":{";
        result << "\"translation\":{\"x\":" << trans.X()
               << ",\"y\":" << trans.Y()
               << ",\"z\":" << trans.Z() << "}";

        // Get rotation as quaternion or matrix if needed
        gp_Mat rotMat = trsf.VectorialPart();
        result << ",\"rotation\":[";
        result << rotMat(1,1) << "," << rotMat(1,2) << "," << rotMat(1,3) << ",";
        result << rotMat(2,1) << "," << rotMat(2,2) << "," << rotMat(2,3) << ",";
        result << rotMat(3,1) << "," << rotMat(3,2) << "," << rotMat(3,3);
        result << "]}";
    }

    // Process children recursively
    const std::vector<TDF_Label> children = collectChildShapeLabels(shapeTool, label);

    if (!children.empty()) {
        result << ",\"children\":[";
        for (size_t i = 0; i < children.size(); ++i) {
            if (i > 0) result << ",";
            buildHierarchyJson(shapeTool, colorTool, children[i], baseId, counter, result, store);
        }
        result << "]";
    }

    result << "}";
}

// Read STEP file from memory buffer and store shapes with hierarchy
// Returns JSON string with hierarchical structure
std::string readStepFromBuffer(const Uint8Array& buffer, const std::string& baseId) {
    std::stringstream result;
    result << "{\"success\":";

    // Reset color generator and part name counter for new STEP file
    g_colorGenerator.reset();
    g_partNameCounter.reset();

    try {
        // Create XCAF document for hierarchy support
        Handle(TDocStd_Document) doc = new TDocStd_Document("MDTV-XCAF");
        STEPCAFControl_Reader reader;

        // Read STEP data from binary stream
        std::vector<uint8_t> input = convertJSArrayToNumberVector<uint8_t>(buffer);
        VectorBuffer vectorBuffer(input);
        std::istream inputStream(&vectorBuffer);
        IFSelect_ReturnStatus status = reader.ReadStream("step_data", inputStream);

        if (status != IFSelect_RetDone) {
            result << "false,\"error\":\"Failed to read STEP data\",\"shapes\":[], \"count\":0}";
            return result.str();
        }

        // Transfer data to XCAF document
        if (!reader.Transfer(doc)) {
            result << "false,\"error\":\"Failed to transfer STEP data\",\"shapes\":[], \"count\":0}";
            return result.str();
        }

        // Get shape tool and color tool
        Handle(XCAFDoc_ShapeTool) shapeTool = XCAFDoc_DocumentTool::ShapeTool(doc->Main());
        Handle(XCAFDoc_ColorTool) colorTool = XCAFDoc_DocumentTool::ColorTool(doc->Main());

        // Get free shapes (root level shapes)
        TDF_LabelSequence freeShapes;
        shapeTool->GetFreeShapes(freeShapes);

        if (freeShapes.Length() == 0) {
            result << "false,\"error\":\"No shapes found in STEP file\",\"shapes\":[], \"count\":0}";
            return result.str();
        }

        result << "true";

        // Build flat shape list for backward compatibility
        result << ",\"shapes\":[";
        auto& store = geo::ShapeStore::instance();
        int shapeCount = 0;

        for (int i = 1; i <= freeShapes.Length(); ++i) {
            TDF_Label label = freeShapes.Value(i);
            TopoDS_Shape shape = shapeTool->GetShape(label);
            if (!shape.IsNull()) {
                std::string shapeId = baseId + "_" + std::to_string(i);
                store.addShape(shapeId, shape);

                if (shapeCount > 0) result << ",";
                result << "\"" << shapeId << "\"";
                shapeCount++;
            }
        }
        result << "]";
        result << ",\"count\":" << shapeCount;

        // Build hierarchical structure with colors
        result << ",\"rootNodes\":[";
        int nodeCounter = 0;
        for (int i = 1; i <= freeShapes.Length(); ++i) {
            if (i > 1) result << ",";
            buildHierarchyJson(shapeTool, colorTool, freeShapes.Value(i), baseId, nodeCounter, result, store);
        }
        result << "]";
        result << "}";

    } catch (const std::exception& e) {
        result << "false,\"error\":\"" << escapeJsonString(e.what()) << "\",\"shapes\":[], \"count\":0}";
    } catch (...) {
        result << "false,\"error\":\"Unknown error reading STEP file\",\"shapes\":[], \"count\":0}";
    }

    return result.str();
}

// ============================================================================
// T2.3: Mesh Generation (for three.js display)
// ============================================================================

struct MeshShapeDataResult {
    bool success;
    val vertices;
    val normals;
    val indices;
    int vertexCount;
    int triangleCount;
    std::optional<std::string> error;
};

struct BRepEdgesDataResult {
    bool success;
    val vertices;
    int segmentCount;
    std::optional<std::string> error;
};

int getCurveSampleCount(const BRepAdaptor_Curve& curveAdaptor,
                        Standard_Real first,
                        Standard_Real last,
                        double targetDeflection)
{
    int sampleCount = 24;
    try {
        const double length = GCPnts_AbscissaPoint::Length(curveAdaptor, first, last);
        if (length > Precision::Confusion()) {
            // Make BRep edge display smoother than shaded mesh tessellation.
            const double safeDeflection = std::max(targetDeflection * 0.45, static_cast<double>(Precision::Confusion()) * 10.0);
            sampleCount = static_cast<int>(std::ceil(length / safeDeflection)) + 1;
        }
    } catch (...) {
        // Keep fallback sample count.
    }

    switch (curveAdaptor.GetType()) {
        case GeomAbs_Line:
            sampleCount = 2;
            break;
        case GeomAbs_Circle:
        {
            constexpr double kTwoPi = 6.28318530717958647692;
            const double span = std::abs(last - first);
            const int spanSamples = static_cast<int>(std::ceil((span / kTwoPi) * 256.0));
            sampleCount = std::max(sampleCount, std::max(96, spanSamples));
            break;
        }
        case GeomAbs_Ellipse:
            sampleCount = std::max(sampleCount, 128);
            break;
        case GeomAbs_BSplineCurve:
        case GeomAbs_BezierCurve:
            sampleCount = std::max(sampleCount, 80);
            break;
        default:
            break;
    }

    return std::max(2, std::min(sampleCount, 1024));
}

BRepEdgesDataResult brepEdgesData(const std::string& id, double linearDeflection)
{
    auto& store = geo::ShapeStore::instance();
    auto shapeOpt = store.getShape(id);

    if (!shapeOpt.has_value()) {
        return {
            false,
            val::array(std::vector<double>()),
            0,
            std::optional<std::string>("Shape not found")
        };
    }

    const TopoDS_Shape shape = shapeOpt.value();
    try {
        const double resolvedLinearDeflection = resolveLinearDeflection(shape, linearDeflection);
        std::vector<double> vertices;
        int segmentCount = 0;

        TopExp_Explorer edgeExplorer(shape, TopAbs_EDGE);
        for (; edgeExplorer.More(); edgeExplorer.Next()) {
            TopoDS_Edge edge = TopoDS::Edge(edgeExplorer.Current());
            if (BRep_Tool::Degenerated(edge)) {
                continue;
            }

            TopLoc_Location location;
            Standard_Real first = 0.0;
            Standard_Real last = 0.0;
            Handle(Geom_Curve) curve = BRep_Tool::Curve(edge, location, first, last);
            if (curve.IsNull()) {
                continue;
            }

            BRepAdaptor_Curve curveAdaptor(edge);
            Standard_Real start = curveAdaptor.FirstParameter();
            Standard_Real end = curveAdaptor.LastParameter();
            if (!std::isfinite(start) || !std::isfinite(end) || std::abs(end - start) <= Precision::Confusion()) {
                start = first;
                end = last;
            }
            if (!std::isfinite(start) || !std::isfinite(end) || std::abs(end - start) <= Precision::Confusion()) {
                continue;
            }

            const int sampleCount = getCurveSampleCount(curveAdaptor, start, end, resolvedLinearDeflection);
            const gp_Trsf locationTransform = location.Transformation();

            gp_Pnt previousPoint;
            bool hasPreviousPoint = false;
            for (int i = 0; i < sampleCount; ++i) {
                const double t = static_cast<double>(i) / static_cast<double>(sampleCount - 1);
                const Standard_Real param = start + (end - start) * t;
                // Use raw geometric curve + edge location once.
                // Avoid applying assembly/location transform twice.
                gp_Pnt point = curve->Value(param).Transformed(locationTransform);

                if (hasPreviousPoint && point.Distance(previousPoint) > Precision::Confusion()) {
                    vertices.push_back(previousPoint.X());
                    vertices.push_back(previousPoint.Y());
                    vertices.push_back(previousPoint.Z());
                    vertices.push_back(point.X());
                    vertices.push_back(point.Y());
                    vertices.push_back(point.Z());
                    segmentCount++;
                }

                previousPoint = point;
                hasPreviousPoint = true;
            }
        }

        return {
            true,
            val::array(vertices),
            segmentCount,
            std::nullopt
        };
    } catch (const std::exception& e) {
        return {
            false,
            val::array(std::vector<double>()),
            0,
            std::optional<std::string>(e.what())
        };
    } catch (...) {
        return {
            false,
            val::array(std::vector<double>()),
            0,
            std::optional<std::string>("Unknown error during BRep edge extraction")
        };
    }
}

MeshShapeDataResult meshShapeData(const std::string& id, double linearDeflection, double angularDeflection) {
    auto& store = geo::ShapeStore::instance();
    auto shapeOpt = store.getShape(id);

    if (!shapeOpt.has_value()) {
        return {
            false,
            val::array(std::vector<double>()),
            val::array(std::vector<double>()),
            val::array(std::vector<int>()),
            0,
            0,
            std::optional<std::string>("Shape not found")
        };
    }

    TopoDS_Shape shape = shapeOpt.value();

    try {
        const double resolvedLinearDeflection = resolveLinearDeflection(shape, linearDeflection);
        BRepMesh_IncrementalMesh mesher(shape, resolvedLinearDeflection, Standard_False, angularDeflection);
        mesher.Perform();

        if (!mesher.IsDone()) {
            return {
                false,
                val::array(std::vector<double>()),
                val::array(std::vector<double>()),
                val::array(std::vector<int>()),
                0,
                0,
                std::optional<std::string>("Meshing failed")
            };
        }

        std::vector<double> vertices;
        std::vector<double> normals;
        std::vector<int> indices;
        int vertexOffset = 0;

        TopExp_Explorer explorer(shape, TopAbs_FACE);
        for (; explorer.More(); explorer.Next()) {
            TopoDS_Face face = TopoDS::Face(explorer.Current());
            TopLoc_Location location;
            Handle(Poly_Triangulation) triangulation = BRep_Tool::Triangulation(face, location);

            if (triangulation.IsNull()) continue;

            gp_Trsf transform = location.Transformation();
            bool reversed = (face.Orientation() == TopAbs_REVERSED);

            int nbNodes = triangulation->NbNodes();
            for (int i = 1; i <= nbNodes; ++i) {
                gp_Pnt p = triangulation->Node(i).Transformed(transform);
                vertices.push_back(p.X());
                vertices.push_back(p.Y());
                vertices.push_back(p.Z());
            }

            if (!triangulation->HasNormals()) {
                BRepLib_ToolTriangulatedShape::ComputeNormals(face, triangulation);
            }

            if (triangulation->HasNormals()) {
                for (int i = 1; i <= nbNodes; ++i) {
                    gp_Dir n = triangulation->Normal(i);
                    if (reversed) {
                        normals.push_back(-n.X());
                        normals.push_back(-n.Y());
                        normals.push_back(-n.Z());
                    } else {
                        normals.push_back(n.X());
                        normals.push_back(n.Y());
                        normals.push_back(n.Z());
                    }
                }
            } else {
                appendFallbackNormals(triangulation, transform, reversed, normals);
            }

            int nbTriangles = triangulation->NbTriangles();
            for (int i = 1; i <= nbTriangles; ++i) {
                Poly_Triangle tri = triangulation->Triangle(i);
                int n1, n2, n3;
                tri.Get(n1, n2, n3);

                if (reversed) {
                    indices.push_back(vertexOffset + n1 - 1);
                    indices.push_back(vertexOffset + n3 - 1);
                    indices.push_back(vertexOffset + n2 - 1);
                } else {
                    indices.push_back(vertexOffset + n1 - 1);
                    indices.push_back(vertexOffset + n2 - 1);
                    indices.push_back(vertexOffset + n3 - 1);
                }
            }

            vertexOffset += nbNodes;
        }

        return {
            true,
            val::array(vertices),
            val::array(normals),
            val::array(indices),
            static_cast<int>(vertices.size() / 3),
            static_cast<int>(indices.size() / 3),
            std::nullopt
        };
    } catch (const std::exception& e) {
        return {
            false,
            val::array(std::vector<double>()),
            val::array(std::vector<double>()),
            val::array(std::vector<int>()),
            0,
            0,
            std::optional<std::string>(e.what())
        };
    } catch (...) {
        return {
            false,
            val::array(std::vector<double>()),
            val::array(std::vector<double>()),
            val::array(std::vector<int>()),
            0,
            0,
            std::optional<std::string>("Unknown error during meshing")
        };
    }
}

val meshShapeDataToVal(const MeshShapeDataResult& data)
{
    val obj = val::object();
    obj.set("success", data.success);
    obj.set("vertices", data.vertices);
    obj.set("normals", data.normals);
    obj.set("indices", data.indices);
    obj.set("vertexCount", data.vertexCount);
    obj.set("triangleCount", data.triangleCount);
    if (data.error.has_value()) {
        obj.set("error", data.error.value());
    } else {
        obj.set("error", val::undefined());
    }
    return obj;
}

val meshShapesData(const val& shapeIds, double linearDeflection, double angularDeflection)
{
    const auto length = shapeIds["length"].as<size_t>();
    val results = val::array();
    for (size_t i = 0; i < length; ++i) {
        const std::string id = shapeIds[i].as<std::string>();
        MeshShapeDataResult data = meshShapeData(id, linearDeflection, angularDeflection);
        results.set(i, meshShapeDataToVal(data));
    }
    return results;
}

// Mesh data structure returned as JSON
// Format: { vertices: [x,y,z,...], indices: [i0,i1,i2,...], normals: [nx,ny,nz,...] }
std::string meshShape(const std::string& id, double linearDeflection, double angularDeflection) {
    auto& store = geo::ShapeStore::instance();
    auto shapeOpt = store.getShape(id);

    if (!shapeOpt.has_value()) {
        return "{\"success\":false,\"error\":\"Shape not found\"}";
    }

    TopoDS_Shape shape = shapeOpt.value();

    try {
        // Generate mesh
        const double resolvedLinearDeflection = resolveLinearDeflection(shape, linearDeflection);
        BRepMesh_IncrementalMesh mesher(shape, resolvedLinearDeflection, Standard_False, angularDeflection);
        mesher.Perform();

        if (!mesher.IsDone()) {
            return "{\"success\":false,\"error\":\"Meshing failed\"}";
        }

        std::vector<double> vertices;
        std::vector<double> normals;
        std::vector<int> indices;
        int vertexOffset = 0;

        // Iterate over all faces
        TopExp_Explorer explorer(shape, TopAbs_FACE);
        for (; explorer.More(); explorer.Next()) {
            TopoDS_Face face = TopoDS::Face(explorer.Current());
            TopLoc_Location location;
            Handle(Poly_Triangulation) triangulation = BRep_Tool::Triangulation(face, location);

            if (triangulation.IsNull()) continue;

            gp_Trsf transform = location.Transformation();
            bool reversed = (face.Orientation() == TopAbs_REVERSED);

            // Get vertices
            int nbNodes = triangulation->NbNodes();
            for (int i = 1; i <= nbNodes; ++i) {
                gp_Pnt p = triangulation->Node(i).Transformed(transform);
                vertices.push_back(p.X());
                vertices.push_back(p.Y());
                vertices.push_back(p.Z());
            }

            // Get normals if available
            if (!triangulation->HasNormals()) {
                BRepLib_ToolTriangulatedShape::ComputeNormals(face, triangulation);
            }

            if (triangulation->HasNormals()) {
                for (int i = 1; i <= nbNodes; ++i) {
                    gp_Dir n = triangulation->Normal(i);
                    if (reversed) {
                        normals.push_back(-n.X());
                        normals.push_back(-n.Y());
                        normals.push_back(-n.Z());
                    } else {
                        normals.push_back(n.X());
                        normals.push_back(n.Y());
                        normals.push_back(n.Z());
                    }
                }
            } else {
                appendFallbackNormals(triangulation, transform, reversed, normals);
            }

            // Get triangles
            int nbTriangles = triangulation->NbTriangles();
            for (int i = 1; i <= nbTriangles; ++i) {
                Poly_Triangle tri = triangulation->Triangle(i);
                int n1, n2, n3;
                tri.Get(n1, n2, n3);

                // Adjust for 0-based indexing and vertex offset
                if (reversed) {
                    indices.push_back(vertexOffset + n1 - 1);
                    indices.push_back(vertexOffset + n3 - 1);
                    indices.push_back(vertexOffset + n2 - 1);
                } else {
                    indices.push_back(vertexOffset + n1 - 1);
                    indices.push_back(vertexOffset + n2 - 1);
                    indices.push_back(vertexOffset + n3 - 1);
                }
            }

            vertexOffset += nbNodes;
        }

        // Build JSON result
        std::stringstream result;
        result << "{\"success\":true,\"vertices\":[";
        for (size_t i = 0; i < vertices.size(); ++i) {
            if (i > 0) result << ",";
            result << vertices[i];
        }
        result << "],\"normals\":[";
        for (size_t i = 0; i < normals.size(); ++i) {
            if (i > 0) result << ",";
            result << normals[i];
        }
        result << "],\"indices\":[";
        for (size_t i = 0; i < indices.size(); ++i) {
            if (i > 0) result << ",";
            result << indices[i];
        }
        result << "],\"vertexCount\":" << (vertices.size() / 3);
        result << ",\"triangleCount\":" << (indices.size() / 3) << "}";

        return result.str();

    } catch (const std::exception& e) {
        return std::string("{\"success\":false,\"error\":\"") + e.what() + "\"}";
    } catch (...) {
        return "{\"success\":false,\"error\":\"Unknown error during meshing\"}";
    }
}

// Mesh with default parameters
std::string meshShapeDefault(const std::string& id) {
    return meshShape(id, 0.0005, 0.2);  // Default: adaptive sag 0.0005, 0.2 rad angular
}

// ============================================================================
// T2.4: Mass Properties Calculation
// ============================================================================

// Calculate mass properties (volume, surface area, center of mass, inertia)
// Returns JSON string with all properties
std::string calculateMassProperties(const std::string& id, double density) {
    auto& store = geo::ShapeStore::instance();
    auto shapeOpt = store.getShape(id);

    if (!shapeOpt.has_value()) {
        return "{\"success\":false,\"error\":\"Shape not found\"}";
    }

    TopoDS_Shape shape = shapeOpt.value();

    try {
        GProp_GProps volumeProps;
        GProp_GProps surfaceProps;

        // Calculate volume properties
        BRepGProp::VolumeProperties(shape, volumeProps);
        double volume = volumeProps.Mass();
        gp_Pnt centerOfMass = volumeProps.CentreOfMass();

        // Calculate surface properties
        BRepGProp::SurfaceProperties(shape, surfaceProps);
        double surfaceArea = surfaceProps.Mass();

        // Calculate mass from density
        double mass = volume * density;

        // Get inertia matrix at center of mass
        gp_Mat inertiaMatrix = volumeProps.MatrixOfInertia();

        // Build JSON result
        std::stringstream result;
        result << std::fixed;
        result << "{\"success\":true";
        result << ",\"volume\":" << volume;
        result << ",\"surfaceArea\":" << surfaceArea;
        result << ",\"mass\":" << mass;
        result << ",\"density\":" << density;
        result << ",\"centerOfMass\":{";
        result << "\"x\":" << centerOfMass.X();
        result << ",\"y\":" << centerOfMass.Y();
        result << ",\"z\":" << centerOfMass.Z() << "}";
        result << ",\"inertia\":{";
        result << "\"ixx\":" << inertiaMatrix(1, 1) * density;
        result << ",\"iyy\":" << inertiaMatrix(2, 2) * density;
        result << ",\"izz\":" << inertiaMatrix(3, 3) * density;
        result << ",\"ixy\":" << inertiaMatrix(1, 2) * density;
        result << ",\"ixz\":" << inertiaMatrix(1, 3) * density;
        result << ",\"iyz\":" << inertiaMatrix(2, 3) * density << "}";
        result << "}";

        return result.str();

    } catch (const std::exception& e) {
        return std::string("{\"success\":false,\"error\":\"") + e.what() + "\"}";
    } catch (...) {
        return "{\"success\":false,\"error\":\"Unknown error calculating mass properties\"}";
    }
}

// Calculate with default density (steel: 7850 kg/m³)
std::string calculateMassPropertiesDefault(const std::string& id) {
    return calculateMassProperties(id, 7850.0);
}

// ============================================================================
// T2.5: Face Normal Calculation for Marker Creation
// ============================================================================

// Get face normal at a clicked point using raycasting
// Returns JSON: { success, position: {x,y,z}, normal: {x,y,z}, faceIndex }
std::string getFaceNormalAtPoint(const std::string& id,
                                  double rayOriginX, double rayOriginY, double rayOriginZ,
                                  double rayDirX, double rayDirY, double rayDirZ) {
    auto& store = geo::ShapeStore::instance();
    auto shapeOpt = store.getShape(id);

    if (!shapeOpt.has_value()) {
        return "{\"success\":false,\"error\":\"Shape not found\"}";
    }

    TopoDS_Shape shape = shapeOpt.value();

    try {
        gp_Pnt rayOrigin(rayOriginX, rayOriginY, rayOriginZ);
        gp_Dir rayDir(rayDirX, rayDirY, rayDirZ);
        gp_Lin ray(rayOrigin, rayDir);

        // Perform intersection
        BRepIntCurveSurface_Inter intersector;
        intersector.Init(shape, ray, 1e-6);  // OCCT precision

        if (!intersector.More()) {
            return "{\"success\":false,\"error\":\"No intersection found\"}";
        }

        // Get the closest intersection point
        double minDistance = 1e10;
        gp_Pnt closestPoint;
        TopoDS_Face closestFace;
        double closestU = 0.0, closestV = 0.0;
        bool found = false;

        for (; intersector.More(); intersector.Next()) {
            gp_Pnt hitPoint = intersector.Pnt();
            double distance = rayOrigin.Distance(hitPoint);

            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = hitPoint;
                closestFace = intersector.Face();
                closestU = intersector.U();
                closestV = intersector.V();
                found = true;
            }
        }

        if (!found) {
            return "{\"success\":false,\"error\":\"No valid intersection\"}";
        }

        // Calculate normal at the intersection point
        BRepAdaptor_Surface surface(closestFace);
        const GeomAbs_SurfaceType surfaceType = surface.GetType();
        BRepLProp_SLProps props(surface, 1, 1e-6);
        props.SetParameters(closestU, closestV);

        if (!props.IsNormalDefined()) {
            return "{\"success\":false,\"error\":\"Normal not defined at intersection point\"}";
        }

        gp_Dir normal = props.Normal();

        // Ensure normal points outward (away from ray origin)
        // If face is reversed, flip the normal
        if (closestFace.Orientation() == TopAbs_REVERSED) {
            normal.Reverse();
        }

        const char* surfaceTypeName = "unknown";
        switch (surfaceType) {
            case GeomAbs_Plane:
                surfaceTypeName = "plane";
                break;
            case GeomAbs_Cylinder:
                surfaceTypeName = "cylinder";
                break;
            case GeomAbs_Sphere:
                surfaceTypeName = "sphere";
                break;
            case GeomAbs_Cone:
                surfaceTypeName = "cone";
                break;
            case GeomAbs_Torus:
                surfaceTypeName = "torus";
                break;
            default:
                break;
        }

        bool hasInferredPlacement = false;
        const char* inferredFeatureName = nullptr;
        gp_Pnt inferredPosition;
        gp_Dir inferredDirection = normal;

        if (surfaceType == GeomAbs_Cylinder) {
            const gp_Cylinder cylinder = surface.Cylinder();
            const gp_Ax1 axis = cylinder.Axis();
            const gp_Lin axisLine(axis);
            const Standard_Real axisParameter = ElCLib::Parameter(axisLine, closestPoint);
            inferredPosition = ElCLib::Value(axisParameter, axisLine);
            inferredDirection = axis.Direction();
            if (inferredDirection.Dot(normal) < 0.0) {
                inferredDirection.Reverse();
            }
            inferredFeatureName = "cylinderAxis";
            hasInferredPlacement = true;
        } else if (surfaceType == GeomAbs_Sphere) {
            const gp_Sphere sphere = surface.Sphere();
            inferredPosition = sphere.Location();
            gp_Vec radial(inferredPosition, closestPoint);
            if (radial.Magnitude() > Precision::Confusion()) {
                inferredDirection = gp_Dir(radial);
            }
            if (inferredDirection.Dot(normal) < 0.0) {
                inferredDirection.Reverse();
            }
            inferredFeatureName = "sphereCenter";
            hasInferredPlacement = true;
        }

        // Build JSON result
        std::stringstream result;
        result << std::fixed;
        result << "{\"success\":true";
        result << ",\"position\":{";
        result << "\"x\":" << closestPoint.X();
        result << ",\"y\":" << closestPoint.Y();
        result << ",\"z\":" << closestPoint.Z() << "}";
        result << ",\"normal\":{";
        result << "\"x\":" << normal.X();
        result << ",\"y\":" << normal.Y();
        result << ",\"z\":" << normal.Z() << "}";
        result << ",\"surfaceType\":\"" << surfaceTypeName << "\"";
        if (hasInferredPlacement && inferredFeatureName != nullptr) {
            result << ",\"inferredFeature\":\"" << inferredFeatureName << "\"";
            result << ",\"inferredPosition\":{";
            result << "\"x\":" << inferredPosition.X();
            result << ",\"y\":" << inferredPosition.Y();
            result << ",\"z\":" << inferredPosition.Z() << "}";
            result << ",\"inferredDirection\":{";
            result << "\"x\":" << inferredDirection.X();
            result << ",\"y\":" << inferredDirection.Y();
            result << ",\"z\":" << inferredDirection.Z() << "}";
        }
        result << ",\"distance\":" << minDistance;
        result << "}";

        return result.str();

    } catch (const std::exception& e) {
        return std::string("{\"success\":false,\"error\":\"") + escapeJsonString(e.what()) + "\"}";
    } catch (...) {
        return "{\"success\":false,\"error\":\"Unknown error calculating face normal\"}";
    }
}

} // anonymous namespace

EMSCRIPTEN_BINDINGS(geo_module) {
    // Primitive creation
    function("makeBox", &makeBox);
    function("makeBoxAt", &makeBoxAt);
    function("makeCylinder", &makeCylinder);
    function("makeCylinderAt", &makeCylinderAt);
    function("makeSphere", &makeSphere);
    function("makeSphereAt", &makeSphereAt);
    function("makeCone", &makeCone);

    // Boolean operations
    function("booleanFuse", &booleanFuse);
    function("booleanCut", &booleanCut);
    function("booleanCommon", &booleanCommon);

    // Shape management
    function("removeShape", &removeShape);
    function("hasShape", &hasShape);
    function("clearShapes", &clearShapes);
    function("getShapeCount", &getShapeCount);

    // T2.2: STEP file reading
    function("readStepFromBuffer", &readStepFromBuffer);

    // T2.3: Mesh generation
    value_object<MeshShapeDataResult>("MeshShapeDataResult")
        .field("success", &MeshShapeDataResult::success)
        .field("vertices", &MeshShapeDataResult::vertices)
        .field("normals", &MeshShapeDataResult::normals)
        .field("indices", &MeshShapeDataResult::indices)
        .field("vertexCount", &MeshShapeDataResult::vertexCount)
        .field("triangleCount", &MeshShapeDataResult::triangleCount)
        .field("error", &MeshShapeDataResult::error);
    value_object<BRepEdgesDataResult>("BRepEdgesDataResult")
        .field("success", &BRepEdgesDataResult::success)
        .field("vertices", &BRepEdgesDataResult::vertices)
        .field("segmentCount", &BRepEdgesDataResult::segmentCount)
        .field("error", &BRepEdgesDataResult::error);
    function("meshShapeData", &meshShapeData);
    function("meshShapesData", &meshShapesData);
    function("brepEdgesData", &brepEdgesData);
    function("meshShape", &meshShape);
    function("meshShapeDefault", &meshShapeDefault);

    // T2.4: Mass properties
    function("calculateMassProperties", &calculateMassProperties);
    function("calculateMassPropertiesDefault", &calculateMassPropertiesDefault);

    // T2.5: Face normal calculation
    function("getFaceNormalAtPoint", &getFaceNormalAtPoint);
}
