// CadToolOnline - MBS (Multi-Body System) bindings for WASM
// Embind 绑定的类必须有 delete() 方法

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "shared.hpp"
#include "../mbs/MbsTypes.h"
#include "../mbs/MbsEntityBase.h"
#include "../mbs/MbsMarker.h"
#include "../mbs/MbsParts.h"
#include "../mbs/MbsGroup.h"
#include "../mbs/MbsConnectorBase.h"
#include "../mbs/MbsJoints.h"
#include "../mbs/MbsJointMotion.h"

using namespace emscripten;

namespace {
    // Helper to convert Mat3 to JavaScript Float64Array
    val getMat3Data(const mbs::Mat3& mat) {
        return val(typed_memory_view(9, mat.m.data()));
    }

    // Helper to convert std::vector<double> to JavaScript array
    val vectorToArray(const std::vector<double>& vec) {
        val arr = val::array();
        for (size_t i = 0; i < vec.size(); ++i) {
            arr.set(i, vec[i]);
        }
        return arr;
    }
}

EMSCRIPTEN_BINDINGS(mbs_module) {
    // ========================================================================
    // 注册 std::vector<double> 类型
    // ========================================================================
    register_vector<double>("VectorDouble");

    // ========================================================================
    // 枚举类型
    // ========================================================================
    enum_<mbs::JointType>("MbsJointType")
        .value("Revolute", mbs::JointType::Revolute)
        .value("Prismatic", mbs::JointType::Prismatic)
        .value("Cylindrical", mbs::JointType::Cylindrical)
        .value("Spherical", mbs::JointType::Spherical)
        .value("Universal", mbs::JointType::Universal)
        .value("Planar", mbs::JointType::Planar)
        .value("Fixed", mbs::JointType::Fixed);

    enum_<mbs::MotionType>("MbsMotionType")
        .value("Rotational", mbs::MotionType::Rotational)
        .value("Translational", mbs::MotionType::Translational);

    enum_<mbs::EntityType>("MbsEntityType")
        .value("Group", mbs::EntityType::Group)
        .value("Parts", mbs::EntityType::Parts)
        .value("Marker", mbs::EntityType::Marker)
        .value("Frame", mbs::EntityType::Frame)
        .value("Connector", mbs::EntityType::Connector)
        .value("Motion", mbs::EntityType::Motion);

    enum_<mbs::MotionFunctionType>("MbsMotionFunctionType")
        .value("Constant", mbs::MotionFunctionType::Constant)
        .value("Step", mbs::MotionFunctionType::Step)
        .value("Ramp", mbs::MotionFunctionType::Ramp)
        .value("Harmonic", mbs::MotionFunctionType::Harmonic)
        .value("Expression", mbs::MotionFunctionType::Expression);

    // ========================================================================
    // 基础类型
    // ========================================================================
    value_object<mbs::Vec3>("MbsVec3")
        .field("x", &mbs::Vec3::x)
        .field("y", &mbs::Vec3::y)
        .field("z", &mbs::Vec3::z);

    class_<mbs::Mat3>("MbsMat3")
        .constructor<>()
        .function("getData", &getMat3Data)
        .function("transposed", &mbs::Mat3::transposed)
        .class_function("identity", &mbs::Mat3::identity)
        .class_function("fromAxisAngle", &mbs::Mat3::fromAxisAngle);

    class_<mbs::Transform>("MbsTransform")
        .constructor<>()
        .constructor<const mbs::Mat3&, const mbs::Vec3&>()
        .property("rotation", &mbs::Transform::rotation)
        .property("translation", &mbs::Transform::translation)
        .function("apply", &mbs::Transform::apply)
        .function("applyInverse", &mbs::Transform::applyInverse)
        .function("inverse", &mbs::Transform::inverse)
        .class_function("identity", &mbs::Transform::identity);

    // ========================================================================
    // MbsEntityBase - 实体基类
    // ========================================================================
    class_<mbs::MbsEntityBase>("MbsEntityBase")
        .function("getId", &mbs::MbsEntityBase::getId)
        .function("getType", &mbs::MbsEntityBase::getType)
        .function("getName", &mbs::MbsEntityBase::getName)
        .function("setName", &mbs::MbsEntityBase::setName)
        .function("isEnabled", &mbs::MbsEntityBase::isEnabled)
        .function("setEnabled", &mbs::MbsEntityBase::setEnabled);

    // ========================================================================
    // MbsMarker - 标记点
    // ========================================================================
    class_<mbs::MbsMarker, base<mbs::MbsEntityBase>>("MbsMarker")
        .constructor<const std::string&>()
        .function("getPosition", &mbs::MbsMarker::getPosition)
        .function("setPosition", select_overload<void(const mbs::Vec3&)>(&mbs::MbsMarker::setPosition))
        .function("getOrientation", &mbs::MbsMarker::getOrientation)
        .function("setOrientation", &mbs::MbsMarker::setOrientation)
        .function("setOrientationFromZAxis", &mbs::MbsMarker::setOrientationFromZAxis)
        .function("getXAxis", &mbs::MbsMarker::getXAxis)
        .function("getYAxis", &mbs::MbsMarker::getYAxis)
        .function("getZAxis", &mbs::MbsMarker::getZAxis)
        .function("getLocalTransform", &mbs::MbsMarker::getLocalTransform)
        .function("getGlobalTransform", &mbs::MbsMarker::getGlobalTransform)
        .function("toLocal", &mbs::MbsMarker::toLocal)
        .function("toGlobal", &mbs::MbsMarker::toGlobal);

    // ========================================================================
    // MbsFrame - 参考坐标系
    // ========================================================================
    class_<mbs::MbsFrame, base<mbs::MbsMarker>>("MbsFrame")
        .constructor<const std::string&>()
        .function("getConnectorId", &mbs::MbsFrame::getConnectorId)
        .function("setConnectorId", &mbs::MbsFrame::setConnectorId)
        .function("isPrimaryFrame", &mbs::MbsFrame::isPrimaryFrame)
        .function("setPrimaryFrame", &mbs::MbsFrame::setPrimaryFrame);

    // ========================================================================
    // MbsParts - 刚体零件
    // ========================================================================
    class_<mbs::MbsParts, base<mbs::MbsEntityBase>>("MbsParts")
        .constructor<const std::string&>()
        .function("getMass", &mbs::MbsParts::getMass)
        .function("setMass", &mbs::MbsParts::setMass)
        .function("getCenterOfMass", &mbs::MbsParts::getCenterOfMass)
        .function("setCenterOfMass", select_overload<void(const mbs::Vec3&)>(&mbs::MbsParts::setCenterOfMass))
        .function("getInertiaMatrix", &mbs::MbsParts::getInertiaMatrix)
        .function("setInertiaMatrix", &mbs::MbsParts::setInertiaMatrix)
        .function("setInertia", &mbs::MbsParts::setInertia)
        .function("getPosition", &mbs::MbsParts::getPosition)
        .function("setPosition", select_overload<void(const mbs::Vec3&)>(&mbs::MbsParts::setPosition))
        .function("getOrientation", &mbs::MbsParts::getOrientation)
        .function("setOrientation", &mbs::MbsParts::setOrientation)
        .function("getLocalTransform", &mbs::MbsParts::getLocalTransform)
        .function("getGlobalTransform", &mbs::MbsParts::getGlobalTransform)
        .function("addShapeId", &mbs::MbsParts::addShapeId)
        .function("removeShapeId", &mbs::MbsParts::removeShapeId)
        .function("clearShapeIds", &mbs::MbsParts::clearShapeIds)
        .function("getMarkerCount", &mbs::MbsParts::getMarkerCount)
        .function("getFrameCount", &mbs::MbsParts::getFrameCount)
        .function("addMarker", &mbs::MbsParts::addMarker, allow_raw_pointers())
        .function("addFrame", &mbs::MbsParts::addFrame, allow_raw_pointers())
        .function("getMarker", &mbs::MbsParts::getMarker, allow_raw_pointers())
        .function("getFrame", &mbs::MbsParts::getFrame, allow_raw_pointers())
        .function("isGround", &mbs::MbsParts::isGround)
        .function("setGround", &mbs::MbsParts::setGround)
        .function("calculatePropertiesFromShapes", &mbs::MbsParts::calculatePropertiesFromShapes);

    // ========================================================================
    // MbsConnectorBase - 关节基类
    // ========================================================================
    class_<mbs::MbsConnectorBase, base<mbs::MbsEntityBase>>("MbsConnectorBase")
        .function("getJointType", &mbs::MbsConnectorBase::getJointType)
        .function("getDof", &mbs::MbsConnectorBase::getDof)
        .function("getIFrame", &mbs::MbsConnectorBase::getIFrame, allow_raw_pointers())
        .function("setIFrame", &mbs::MbsConnectorBase::setIFrame, allow_raw_pointers())
        .function("getJFrame", &mbs::MbsConnectorBase::getJFrame, allow_raw_pointers())
        .function("setJFrame", &mbs::MbsConnectorBase::setJFrame, allow_raw_pointers())
        .function("getRelativeTransform", &mbs::MbsConnectorBase::getRelativeTransform);

    // ========================================================================
    // 关节类型
    // ========================================================================
    class_<mbs::MbsRevolute, base<mbs::MbsConnectorBase>>("MbsRevolute")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsRevolute::getJointPosition)
        .function("getJointVelocity", &mbs::MbsRevolute::getJointVelocity)
        .function("setJointPosition", &mbs::MbsRevolute::setJointPosition)
        .function("setJointVelocity", &mbs::MbsRevolute::setJointVelocity);

    class_<mbs::MbsPrismatic, base<mbs::MbsConnectorBase>>("MbsPrismatic")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsPrismatic::getJointPosition)
        .function("getJointVelocity", &mbs::MbsPrismatic::getJointVelocity)
        .function("setJointPosition", &mbs::MbsPrismatic::setJointPosition)
        .function("setJointVelocity", &mbs::MbsPrismatic::setJointVelocity);

    class_<mbs::MbsCylindrical, base<mbs::MbsConnectorBase>>("MbsCylindrical")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsCylindrical::getJointPosition)
        .function("getJointVelocity", &mbs::MbsCylindrical::getJointVelocity)
        .function("setJointPosition", &mbs::MbsCylindrical::setJointPosition)
        .function("setJointVelocity", &mbs::MbsCylindrical::setJointVelocity);

    class_<mbs::MbsSpherical, base<mbs::MbsConnectorBase>>("MbsSpherical")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsSpherical::getJointPosition)
        .function("getJointVelocity", &mbs::MbsSpherical::getJointVelocity)
        .function("setJointPosition", &mbs::MbsSpherical::setJointPosition)
        .function("setJointVelocity", &mbs::MbsSpherical::setJointVelocity)
        .function("setEulerAngles", &mbs::MbsSpherical::setEulerAngles);

    class_<mbs::MbsUniversal, base<mbs::MbsConnectorBase>>("MbsUniversal")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsUniversal::getJointPosition)
        .function("getJointVelocity", &mbs::MbsUniversal::getJointVelocity)
        .function("setJointPosition", &mbs::MbsUniversal::setJointPosition)
        .function("setJointVelocity", &mbs::MbsUniversal::setJointVelocity);

    class_<mbs::MbsPlanar, base<mbs::MbsConnectorBase>>("MbsPlanar")
        .constructor<const std::string&>()
        .function("getJointPosition", &mbs::MbsPlanar::getJointPosition)
        .function("getJointVelocity", &mbs::MbsPlanar::getJointVelocity)
        .function("setJointPosition", &mbs::MbsPlanar::setJointPosition)
        .function("setJointVelocity", &mbs::MbsPlanar::setJointVelocity);

    class_<mbs::MbsFixed, base<mbs::MbsConnectorBase>>("MbsFixed")
        .constructor<const std::string&>();

    // ========================================================================
    // MbsJointMotion - 关节驱动
    // ========================================================================
    class_<mbs::MbsJointMotionBase, base<mbs::MbsEntityBase>>("MbsJointMotionBase")
        .function("getMotionType", &mbs::MbsJointMotionBase::getMotionType)
        .function("getConnector", &mbs::MbsJointMotionBase::getConnector, allow_raw_pointers())
        .function("setConnector", &mbs::MbsJointMotionBase::setConnector, allow_raw_pointers())
        .function("getDofIndex", &mbs::MbsJointMotionBase::getDofIndex)
        .function("setDofIndex", &mbs::MbsJointMotionBase::setDofIndex)
        .function("getFunctionType", &mbs::MbsJointMotionBase::getFunctionType)
        .function("setFunctionType", &mbs::MbsJointMotionBase::setFunctionType)
        .function("evaluate", &mbs::MbsJointMotionBase::evaluate)
        .function("evaluateDerivative", &mbs::MbsJointMotionBase::evaluateDerivative)
        .function("isEnabled", &mbs::MbsJointMotionBase::isEnabled)
        .function("setEnabled", &mbs::MbsJointMotionBase::setEnabled);

    class_<mbs::MbsRotationalMotion, base<mbs::MbsJointMotionBase>>("MbsRotationalMotion")
        .constructor<const std::string&>()
        .function("getInitialAngle", &mbs::MbsRotationalMotion::getInitialAngle)
        .function("setInitialAngle", &mbs::MbsRotationalMotion::setInitialAngle)
        .function("getInitialAngularVelocity", &mbs::MbsRotationalMotion::getInitialAngularVelocity)
        .function("setInitialAngularVelocity", &mbs::MbsRotationalMotion::setInitialAngularVelocity)
        .function("getConstantValue", &mbs::MbsRotationalMotion::getConstantValue)
        .function("setConstantValue", &mbs::MbsRotationalMotion::setConstantValue)
        .function("getAmplitude", &mbs::MbsRotationalMotion::getAmplitude)
        .function("setAmplitude", &mbs::MbsRotationalMotion::setAmplitude)
        .function("getFrequency", &mbs::MbsRotationalMotion::getFrequency)
        .function("setFrequency", &mbs::MbsRotationalMotion::setFrequency)
        .function("getPhase", &mbs::MbsRotationalMotion::getPhase)
        .function("setPhase", &mbs::MbsRotationalMotion::setPhase)
        .function("getSlope", &mbs::MbsRotationalMotion::getSlope)
        .function("setSlope", &mbs::MbsRotationalMotion::setSlope)
        .function("getOffset", &mbs::MbsRotationalMotion::getOffset)
        .function("setOffset", &mbs::MbsRotationalMotion::setOffset)
        .function("getStepTime", &mbs::MbsRotationalMotion::getStepTime)
        .function("setStepTime", &mbs::MbsRotationalMotion::setStepTime)
        .function("getStepValue", &mbs::MbsRotationalMotion::getStepValue)
        .function("setStepValue", &mbs::MbsRotationalMotion::setStepValue);

    class_<mbs::MbsTranslationalMotion, base<mbs::MbsJointMotionBase>>("MbsTranslationalMotion")
        .constructor<const std::string&>()
        .function("getInitialDisplacement", &mbs::MbsTranslationalMotion::getInitialDisplacement)
        .function("setInitialDisplacement", &mbs::MbsTranslationalMotion::setInitialDisplacement)
        .function("getInitialVelocity", &mbs::MbsTranslationalMotion::getInitialVelocity)
        .function("setInitialVelocity", &mbs::MbsTranslationalMotion::setInitialVelocity)
        .function("getConstantValue", &mbs::MbsTranslationalMotion::getConstantValue)
        .function("setConstantValue", &mbs::MbsTranslationalMotion::setConstantValue)
        .function("getAmplitude", &mbs::MbsTranslationalMotion::getAmplitude)
        .function("setAmplitude", &mbs::MbsTranslationalMotion::setAmplitude)
        .function("getFrequency", &mbs::MbsTranslationalMotion::getFrequency)
        .function("setFrequency", &mbs::MbsTranslationalMotion::setFrequency)
        .function("getPhase", &mbs::MbsTranslationalMotion::getPhase)
        .function("setPhase", &mbs::MbsTranslationalMotion::setPhase)
        .function("getSlope", &mbs::MbsTranslationalMotion::getSlope)
        .function("setSlope", &mbs::MbsTranslationalMotion::setSlope)
        .function("getOffset", &mbs::MbsTranslationalMotion::getOffset)
        .function("setOffset", &mbs::MbsTranslationalMotion::setOffset)
        .function("getStepTime", &mbs::MbsTranslationalMotion::getStepTime)
        .function("setStepTime", &mbs::MbsTranslationalMotion::setStepTime)
        .function("getStepValue", &mbs::MbsTranslationalMotion::getStepValue)
        .function("setStepValue", &mbs::MbsTranslationalMotion::setStepValue);

    // ========================================================================
    // MbsGroup - 刚体分组
    // ========================================================================
    class_<mbs::MbsGroup, base<mbs::MbsEntityBase>>("MbsGroup")
        .constructor<const std::string&>()
        .function("getTotalMass", &mbs::MbsGroup::getTotalMass)
        .function("getCenterOfMass", &mbs::MbsGroup::getCenterOfMass)
        .function("getInertiaMatrix", &mbs::MbsGroup::getInertiaMatrix)
        .function("getPosition", &mbs::MbsGroup::getPosition)
        .function("setPosition", select_overload<void(const mbs::Vec3&)>(&mbs::MbsGroup::setPosition))
        .function("getOrientation", &mbs::MbsGroup::getOrientation)
        .function("setOrientation", &mbs::MbsGroup::setOrientation)
        .function("getLocalTransform", &mbs::MbsGroup::getLocalTransform)
        .function("getGlobalTransform", &mbs::MbsGroup::getGlobalTransform)
        .function("addParts", &mbs::MbsGroup::addParts, allow_raw_pointers())
        .function("getParts", &mbs::MbsGroup::getParts, allow_raw_pointers())
        .function("getPartsById", &mbs::MbsGroup::getPartsById, allow_raw_pointers())
        .function("getPartsCount", &mbs::MbsGroup::getPartsCount)
        .function("removeParts", &mbs::MbsGroup::removeParts)
        .function("getConnector", &mbs::MbsGroup::getConnector, allow_raw_pointers())
        .function("getConnectorById", &mbs::MbsGroup::getConnectorById, allow_raw_pointers())
        .function("getConnectorCount", &mbs::MbsGroup::getConnectorCount)
        .function("getMotion", &mbs::MbsGroup::getMotion, allow_raw_pointers())
        .function("getMotionCount", &mbs::MbsGroup::getMotionCount)
        .function("getParentGroup", &mbs::MbsGroup::getParentGroup, allow_raw_pointers())
        .function("setParentGroup", &mbs::MbsGroup::setParentGroup, allow_raw_pointers())
        .function("isRoot", &mbs::MbsGroup::isRoot)
        .function("calculateAggregateProperties", &mbs::MbsGroup::calculateAggregateProperties)
        // 兼容旧接口
        .function("getMass", &mbs::MbsGroup::getMass)
        .function("addShapeId", &mbs::MbsGroup::addShapeId)
        .function("removeShapeId", &mbs::MbsGroup::removeShapeId)
        .function("calculateProperties", &mbs::MbsGroup::calculateProperties);
}
