#include "MbsJointMotion.h"
#include "MbsConnectorBase.h"
#include <cmath>

namespace mbs {

// ============================================================================
// MbsJointMotionBase 实现
// ============================================================================
MbsJointMotionBase::MbsJointMotionBase(MotionType type, const std::string& name)
    : MbsEntityBase(EntityType::Motion, name), motionType_(type) {}

void MbsJointMotionBase::setConnector(MbsConnectorBase* connector) {
    connector_ = connector;
}

// ============================================================================
// MbsRotationalMotion 实现
// ============================================================================
MbsRotationalMotion::MbsRotationalMotion(const std::string& name)
    : MbsJointMotionBase(MotionType::Rotational, name) {}

double MbsRotationalMotion::evaluate(double time) const {
    switch (functionType_) {
        case MotionFunctionType::Constant:
            return constantValue_;

        case MotionFunctionType::Step:
            return (time >= stepTime_) ? stepValue_ : 0.0;

        case MotionFunctionType::Ramp:
            return slope_ * time + offset_;

        case MotionFunctionType::Harmonic: {
            double omega = 2.0 * PI * frequency_;
            return amplitude_ * std::sin(omega * time + phase_);
        }

        case MotionFunctionType::Expression:
            // 表达式驱动需要外部解析器，暂返回 0
            return 0.0;

        default:
            return 0.0;
    }
}

double MbsRotationalMotion::evaluateDerivative(double time) const {
    switch (functionType_) {
        case MotionFunctionType::Constant:
            return 0.0;

        case MotionFunctionType::Step:
            return 0.0;  // 阶跃函数导数为 0 (除了跳变点)

        case MotionFunctionType::Ramp:
            return slope_;

        case MotionFunctionType::Harmonic: {
            double omega = 2.0 * PI * frequency_;
            return amplitude_ * omega * std::cos(omega * time + phase_);
        }

        case MotionFunctionType::Expression:
            return 0.0;

        default:
            return 0.0;
    }
}

// ============================================================================
// MbsTranslationalMotion 实现
// ============================================================================
MbsTranslationalMotion::MbsTranslationalMotion(const std::string& name)
    : MbsJointMotionBase(MotionType::Translational, name) {}

double MbsTranslationalMotion::evaluate(double time) const {
    switch (functionType_) {
        case MotionFunctionType::Constant:
            return constantValue_;

        case MotionFunctionType::Step:
            return (time >= stepTime_) ? stepValue_ : 0.0;

        case MotionFunctionType::Ramp:
            return slope_ * time + offset_;

        case MotionFunctionType::Harmonic: {
            double omega = 2.0 * PI * frequency_;
            return amplitude_ * std::sin(omega * time + phase_);
        }

        case MotionFunctionType::Expression:
            return 0.0;

        default:
            return 0.0;
    }
}

double MbsTranslationalMotion::evaluateDerivative(double time) const {
    switch (functionType_) {
        case MotionFunctionType::Constant:
            return 0.0;

        case MotionFunctionType::Step:
            return 0.0;

        case MotionFunctionType::Ramp:
            return slope_;

        case MotionFunctionType::Harmonic: {
            double omega = 2.0 * PI * frequency_;
            return amplitude_ * omega * std::cos(omega * time + phase_);
        }

        case MotionFunctionType::Expression:
            return 0.0;

        default:
            return 0.0;
    }
}

} // namespace mbs
