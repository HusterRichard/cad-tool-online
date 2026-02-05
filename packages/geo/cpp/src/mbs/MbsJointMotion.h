#pragma once

#include "MbsEntityBase.h"
#include "MbsTypes.h"
#include <functional>

namespace mbs {

// 前向声明
class MbsConnectorBase;

// 驱动函数类型枚举
enum class MotionFunctionType {
    Constant,   // 常量
    Step,       // 阶跃
    Ramp,       // 斜坡
    Harmonic,   // 谐波 (正弦)
    Expression  // 表达式
};

// MbsJointMotionBase - 关节驱动基类
class MbsJointMotionBase : public MbsEntityBase {
public:
    explicit MbsJointMotionBase(MotionType type, const std::string& name = "");
    ~MbsJointMotionBase() override = default;

    // 驱动类型
    MotionType getMotionType() const { return motionType_; }

    // 关联的连接器
    MbsConnectorBase* getConnector() const { return connector_; }
    void setConnector(MbsConnectorBase* connector);

    // 驱动的自由度索引 (对于多自由度关节)
    int getDofIndex() const { return dofIndex_; }
    void setDofIndex(int index) { dofIndex_ = index; }

    // 驱动函数类型
    MotionFunctionType getFunctionType() const { return functionType_; }
    void setFunctionType(MotionFunctionType type) { functionType_ = type; }

    // 计算驱动值
    virtual double evaluate(double time) const = 0;
    virtual double evaluateDerivative(double time) const = 0;

    // 是否启用
    bool isEnabled() const { return enabled_; }
    void setEnabled(bool enabled) { enabled_ = enabled; }

protected:
    MotionType motionType_;
    MbsConnectorBase* connector_ = nullptr;
    int dofIndex_ = 0;
    MotionFunctionType functionType_ = MotionFunctionType::Constant;
    bool enabled_ = true;
};

// ============================================================================
// MbsRotationalMotion - 旋转驱动
// ============================================================================
class MbsRotationalMotion : public MbsJointMotionBase {
public:
    explicit MbsRotationalMotion(const std::string& name = "");
    ~MbsRotationalMotion() override = default;

    // 初始状态
    double getInitialAngle() const { return initialAngle_; }
    void setInitialAngle(double angle) { initialAngle_ = angle; }

    double getInitialAngularVelocity() const { return initialAngularVelocity_; }
    void setInitialAngularVelocity(double vel) { initialAngularVelocity_ = vel; }

    // 常量驱动参数
    double getConstantValue() const { return constantValue_; }
    void setConstantValue(double value) { constantValue_ = value; }

    // 谐波驱动参数 (A * sin(omega * t + phi))
    double getAmplitude() const { return amplitude_; }
    void setAmplitude(double amp) { amplitude_ = amp; }

    double getFrequency() const { return frequency_; }
    void setFrequency(double freq) { frequency_ = freq; }

    double getPhase() const { return phase_; }
    void setPhase(double phase) { phase_ = phase; }

    // 斜坡驱动参数
    double getSlope() const { return slope_; }
    void setSlope(double slope) { slope_ = slope; }

    double getOffset() const { return offset_; }
    void setOffset(double offset) { offset_ = offset; }

    // 阶跃驱动参数
    double getStepTime() const { return stepTime_; }
    void setStepTime(double time) { stepTime_ = time; }

    double getStepValue() const { return stepValue_; }
    void setStepValue(double value) { stepValue_ = value; }

    // 计算驱动值
    double evaluate(double time) const override;
    double evaluateDerivative(double time) const override;

private:
    // 初始状态
    double initialAngle_ = 0.0;
    double initialAngularVelocity_ = 0.0;

    // 常量驱动
    double constantValue_ = 0.0;

    // 谐波驱动
    double amplitude_ = 0.0;
    double frequency_ = 1.0;  // Hz
    double phase_ = 0.0;

    // 斜坡驱动
    double slope_ = 0.0;
    double offset_ = 0.0;

    // 阶跃驱动
    double stepTime_ = 0.0;
    double stepValue_ = 0.0;
};

// ============================================================================
// MbsTranslationalMotion - 平移驱动
// ============================================================================
class MbsTranslationalMotion : public MbsJointMotionBase {
public:
    explicit MbsTranslationalMotion(const std::string& name = "");
    ~MbsTranslationalMotion() override = default;

    // 初始状态
    double getInitialDisplacement() const { return initialDisplacement_; }
    void setInitialDisplacement(double disp) { initialDisplacement_ = disp; }

    double getInitialVelocity() const { return initialVelocity_; }
    void setInitialVelocity(double vel) { initialVelocity_ = vel; }

    // 常量驱动参数
    double getConstantValue() const { return constantValue_; }
    void setConstantValue(double value) { constantValue_ = value; }

    // 谐波驱动参数 (A * sin(omega * t + phi))
    double getAmplitude() const { return amplitude_; }
    void setAmplitude(double amp) { amplitude_ = amp; }

    double getFrequency() const { return frequency_; }
    void setFrequency(double freq) { frequency_ = freq; }

    double getPhase() const { return phase_; }
    void setPhase(double phase) { phase_ = phase; }

    // 斜坡驱动参数
    double getSlope() const { return slope_; }
    void setSlope(double slope) { slope_ = slope; }

    double getOffset() const { return offset_; }
    void setOffset(double offset) { offset_ = offset; }

    // 阶跃驱动参数
    double getStepTime() const { return stepTime_; }
    void setStepTime(double time) { stepTime_ = time; }

    double getStepValue() const { return stepValue_; }
    void setStepValue(double value) { stepValue_ = value; }

    // 计算驱动值
    double evaluate(double time) const override;
    double evaluateDerivative(double time) const override;

private:
    // 初始状态
    double initialDisplacement_ = 0.0;
    double initialVelocity_ = 0.0;

    // 常量驱动
    double constantValue_ = 0.0;

    // 谐波驱动
    double amplitude_ = 0.0;
    double frequency_ = 1.0;  // Hz
    double phase_ = 0.0;

    // 斜坡驱动
    double slope_ = 0.0;
    double offset_ = 0.0;

    // 阶跃驱动
    double stepTime_ = 0.0;
    double stepValue_ = 0.0;
};

} // namespace mbs
