// CadToolOnline - MBS (Multi-Body System) bindings for WASM
// Embind 绑定的类必须有 delete() 方法

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "shared.hpp"
#include "../mbs/MbsGroup.h"

using namespace emscripten;

namespace {
    // Helper to convert Mat3 to JavaScript Float64Array
    val getMat3Data(const mbs::Mat3& mat) {
        return val(typed_memory_view(9, mat.m.data()));
    }
}

EMSCRIPTEN_BINDINGS(mbs_module) {
    // Vec3 - MBS 专用向量类型
    value_object<mbs::Vec3>("MbsVec3")
        .field("x", &mbs::Vec3::x)
        .field("y", &mbs::Vec3::y)
        .field("z", &mbs::Vec3::z);

    // Mat3 - 3x3 惯性矩阵 (row-major order)
    class_<mbs::Mat3>("MbsMat3")
        .constructor<>()
        .function("getData", &getMat3Data);

    // MbsGroup - 刚体分组
    // Embind 自动提供 delete() 方法，无需显式绑定
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
