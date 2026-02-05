#include "MbsGroup.h"
#include "../geo/ShapeStore.h"
#include <algorithm>

// OCCT headers for mass properties calculation
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <GProp_PrincipalProps.hxx>
#include <gp_Pnt.hxx>
#include <gp_Mat.hxx>
#include <TopoDS_Compound.hxx>
#include <BRep_Builder.hxx>

namespace mbs {

MbsGroup::MbsGroup(const std::string& name) : name_(name) {}

MbsGroup::~MbsGroup() = default;

void MbsGroup::addShapeId(const std::string& shapeId) {
    if (std::find(shapeIds_.begin(), shapeIds_.end(), shapeId) == shapeIds_.end()) {
        shapeIds_.push_back(shapeId);
    }
}

void MbsGroup::removeShapeId(const std::string& shapeId) {
    auto it = std::find(shapeIds_.begin(), shapeIds_.end(), shapeId);
    if (it != shapeIds_.end()) {
        shapeIds_.erase(it);
    }
}

void MbsGroup::calculateProperties() {
    if (shapeIds_.empty()) {
        mass_ = 0.0;
        centerOfMass_ = Vec3();
        inertiaMatrix_ = Mat3();
        return;
    }

    // Build compound from all shapes
    TopoDS_Compound compound;
    BRep_Builder builder;
    builder.MakeCompound(compound);

    auto& store = geo::ShapeStore::instance();
    int validShapes = 0;

    for (const auto& id : shapeIds_) {
        auto shape = store.getShape(id);
        if (shape.has_value()) {
            builder.Add(compound, shape.value());
            validShapes++;
        }
    }

    if (validShapes == 0) {
        mass_ = 0.0;
        centerOfMass_ = Vec3();
        inertiaMatrix_ = Mat3();
        return;
    }

    // Calculate volume properties using OCCT
    GProp_GProps props;
    BRepGProp::VolumeProperties(compound, props);

    // Get mass (volume with density = 1.0)
    mass_ = props.Mass();

    // Get center of mass
    gp_Pnt com = props.CentreOfMass();
    centerOfMass_ = Vec3(com.X(), com.Y(), com.Z());

    // Get inertia matrix at center of mass
    gp_Mat mat = props.MatrixOfInertia();
    inertiaMatrix_.m = {
        mat.Value(1, 1), mat.Value(1, 2), mat.Value(1, 3),
        mat.Value(2, 1), mat.Value(2, 2), mat.Value(2, 3),
        mat.Value(3, 1), mat.Value(3, 2), mat.Value(3, 3)
    };
}

} // namespace mbs
