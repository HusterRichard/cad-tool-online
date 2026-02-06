// CadToolOnline - Geometry bindings for WASM
// Provides shape creation and management functions using OCCT

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <vector>
#include <sstream>

#include "ShapeStore.h"

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
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>
#include <BRep_Tool.hxx>
#include <Poly_Triangulation.hxx>
#include <TopLoc_Location.hxx>
#include <gp_Trsf.hxx>

// T2.4: Mass properties
#include <GProp_GProps.hxx>
#include <BRepGProp.hxx>

// For random color generation
#include <cmath>
#include <algorithm>
#include <locale>
#include <codecvt>

using namespace emscripten;

namespace {

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

// Helper function to recursively build hierarchy JSON
void buildHierarchyJson(const Handle(XCAFDoc_ShapeTool)& shapeTool,
                        const Handle(XCAFDoc_ColorTool)& colorTool,
                        const TDF_Label& label,
                        const std::string& baseId,
                        int& counter,
                        std::stringstream& result,
                        geo::ShapeStore& store) {
    // Get name with UTF-8 support and fallback to Part+number for invalid names
    Handle(TDataStd_Name) nameAttr;
    std::string name;
    bool nameFound = false;

    if (label.FindAttribute(TDataStd_Name::GetID(), nameAttr)) {
        TCollection_ExtendedString extName = nameAttr->Get();
        std::string convertedName = extendedStringToUtf8(extName);

        // Validate the converted name
        if (isValidPartName(convertedName)) {
            name = convertedName;
            nameFound = true;
        }
    }

    // Fallback to Part+number if no valid name found
    if (!nameFound) {
        name = g_partNameCounter.getNextPartName();
    }

    // Determine node type
    bool isAssembly = shapeTool->IsAssembly(label);
    bool isSimpleShape = shapeTool->IsSimpleShape(label);

    std::string nodeType = isAssembly ? "assembly" : (isSimpleShape ? "solid" : "part");
    std::string nodeId = baseId + "_node_" + std::to_string(++counter);

    result << "{\"id\":\"" << nodeId << "\"";
    result << ",\"name\":\"" << escapeJsonString(name) << "\"";
    result << ",\"type\":\"" << nodeType << "\"";

    // Extract color information
    Quantity_Color color;
    bool hasColor = false;

    // Try to get color from the label
    if (colorTool->GetColor(label, XCAFDoc_ColorSurf, color)) {
        hasColor = true;
    } else if (colorTool->GetColor(label, XCAFDoc_ColorGen, color)) {
        hasColor = true;
    } else if (colorTool->GetColor(label, XCAFDoc_ColorCurv, color)) {
        hasColor = true;
    }

    // Output color as hex RGB
    if (hasColor) {
        // Use color from STEP file
        int r = static_cast<int>(color.Red() * 255.0);
        int g = static_cast<int>(color.Green() * 255.0);
        int b = static_cast<int>(color.Blue() * 255.0);

        // Format as hex color
        char hexColor[8];
        snprintf(hexColor, sizeof(hexColor), "#%02X%02X%02X", r, g, b);
        result << ",\"color\":\"" << hexColor << "\"";
    } else {
        // Generate a smart random color for parts without color info
        // Only assign color to actual parts (not assemblies)
        if (isSimpleShape || (!isAssembly && nodeType == "part")) {
            std::string smartColor = g_colorGenerator.getNextColor();
            result << ",\"color\":\"" << smartColor << "\"";
        } else {
            // Assemblies get a neutral gray
            result << ",\"color\":\"#C0C0C0\"";
        }
    }

    // Store shape if it's a solid/part
    if (isSimpleShape || !isAssembly) {
        TopoDS_Shape shape = shapeTool->GetShape(label);
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
    TDF_ChildIterator it(label);
    std::vector<TDF_Label> children;
    for (; it.More(); it.Next()) {
        if (shapeTool->IsShape(it.Value())) {
            children.push_back(it.Value());
        }
    }

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
std::string readStepFromBuffer(const std::string& buffer, const std::string& baseId) {
    std::stringstream result;
    result << "{\"success\":";

    // Reset color generator and part name counter for new STEP file
    g_colorGenerator.reset();
    g_partNameCounter.reset();

    try {
        // Create XCAF document for hierarchy support
        Handle(TDocStd_Document) doc = new TDocStd_Document("MDTV-XCAF");
        STEPCAFControl_Reader reader;

        // Read STEP data from stream
        std::istringstream inputStream(buffer);
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
        BRepMesh_IncrementalMesh mesher(shape, linearDeflection, Standard_False, angularDeflection);
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
                // Generate flat normals
                for (int i = 1; i <= nbNodes; ++i) {
                    normals.push_back(0.0);
                    normals.push_back(0.0);
                    normals.push_back(1.0);
                }
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
    return meshShape(id, 0.1, 0.5);  // Default: 0.1mm linear, 0.5 rad angular
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
    function("meshShape", &meshShape);
    function("meshShapeDefault", &meshShapeDefault);

    // T2.4: Mass properties
    function("calculateMassProperties", &calculateMassProperties);
    function("calculateMassPropertiesDefault", &calculateMassPropertiesDefault);
}
