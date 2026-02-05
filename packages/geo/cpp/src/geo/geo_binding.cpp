// CadToolOnline - Geometry bindings for WASM
// Provides shape creation and management functions using OCCT

#include <emscripten/bind.h>
#include <string>

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
}
