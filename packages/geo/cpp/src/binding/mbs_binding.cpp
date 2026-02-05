#include <emscripten/bind.h>
#include "../mbs/MbsGroup.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(mbs_module) {
    // Vec3
    value_object<mbs::Vec3>("Vec3")
        .field("x", &mbs::Vec3::x)
        .field("y", &mbs::Vec3::y)
        .field("z", &mbs::Vec3::z);

    // Mat3
    value_object<mbs::Mat3>("Mat3")
        .field("m", &mbs::Mat3::m);

    // MbsGroup
    class_<mbs::MbsGroup>("MbsGroup")
        .constructor<const std::string&>()
        .function("getName", &mbs::MbsGroup::getName)
        .function("setName", &mbs::MbsGroup::setName)
        .function("getMass", &mbs::MbsGroup::getMass)
        .function("getCenterOfMass", &mbs::MbsGroup::getCenterOfMass)
        .function("getInertiaMatrix", &mbs::MbsGroup::getInertiaMatrix)
        .function("addShapeId", &mbs::MbsGroup::addShapeId)
        .function("removeShapeId", &mbs::MbsGroup::removeShapeId)
        .function("calculateProperties", &mbs::MbsGroup::calculateProperties);
}
