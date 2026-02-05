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

using namespace emscripten;

namespace {

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
// T2.2: STEP File Reading
// ============================================================================

// Read STEP file from memory buffer and store shapes
// Returns JSON string with shape IDs and status
std::string readStepFromBuffer(const std::string& buffer, const std::string& baseId) {
    std::stringstream result;
    result << "{\"success\":";

    try {
        STEPControl_Reader reader;

        // OCCT V8: ReadStream takes an istream reference
        std::istringstream inputStream(buffer);
        IFSelect_ReturnStatus status = reader.ReadStream("step_data", inputStream);

        if (status != IFSelect_RetDone) {
            result << "false,\"error\":\"Failed to read STEP data\",\"shapes\":[]}";
            return result.str();
        }

        // Transfer all roots
        int numRoots = reader.NbRootsForTransfer();
        reader.TransferRoots();

        int numShapes = reader.NbShapes();
        if (numShapes == 0) {
            result << "false,\"error\":\"No shapes found in STEP file\",\"shapes\":[]}";
            return result.str();
        }

        result << "true,\"shapes\":[";
        auto& store = geo::ShapeStore::instance();

        for (int i = 1; i <= numShapes; ++i) {
            TopoDS_Shape shape = reader.Shape(i);
            if (!shape.IsNull()) {
                std::string shapeId = baseId + "_" + std::to_string(i);
                store.addShape(shapeId, shape);

                if (i > 1) result << ",";
                result << "\"" << shapeId << "\"";
            }
        }

        result << "],\"count\":" << numShapes << "}";
    } catch (const std::exception& e) {
        result << "false,\"error\":\"" << e.what() << "\",\"shapes\":[]}";
    } catch (...) {
        result << "false,\"error\":\"Unknown error reading STEP file\",\"shapes\":[]}";
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
