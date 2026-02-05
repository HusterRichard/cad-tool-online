#pragma once

#include "MbsEntityBase.h"
#include "MbsMarker.h"
#include "MbsTypes.h"
#include <array>

namespace mbs {

// 前向声明
class MbsJointMotionBase;

// MbsConnectorBase - 关节连接器基类
class MbsConnectorBase : public MbsEntityBase {
public:
    explicit MbsConnectorBase(JointType type, const std::string& name = "");
    ~MbsConnectorBase() override = default;

    // 关节类型
    JointType getJointType() const { return jointType_; }

    // 自由度
    virtual int getDegreesOfFreedom() const = 0;
    int getDof() const { return getDegreesOfFreedom(); }  // 别名

    // I-Frame (主 Frame，通常在父体上)
    MbsFrame* getIFrame() const { return iFrame_; }
    void setIFrame(MbsFrame* frame);

    // J-Frame (从 Frame，通常在子体上)
    MbsFrame* getJFrame() const { return jFrame_; }
    void setJFrame(MbsFrame* frame);

    // 关联的驱动
    MbsJointMotionBase* getMotion() const { return motion_; }
    void setMotion(MbsJointMotionBase* motion) { motion_ = motion; }

    // 关节状态
    virtual std::vector<double> getJointPosition() const = 0;
    virtual std::vector<double> getJointVelocity() const = 0;
    virtual void setJointPosition(const std::vector<double>& pos) = 0;
    virtual void setJointVelocity(const std::vector<double>& vel) = 0;

    // 计算从 I-Frame 到 J-Frame 的相对变换
    virtual Transform getRelativeTransform() const = 0;

    // 关节限位
    bool hasLimits() const { return hasLimits_; }
    void setHasLimits(bool hasLimits) { hasLimits_ = hasLimits; }

    virtual void setLowerLimits(const std::vector<double>& limits) { lowerLimits_ = limits; }
    virtual void setUpperLimits(const std::vector<double>& limits) { upperLimits_ = limits; }
    const std::vector<double>& getLowerLimits() const { return lowerLimits_; }
    const std::vector<double>& getUpperLimits() const { return upperLimits_; }

    // 关节阻尼和刚度
    void setDamping(double damping) { damping_ = damping; }
    double getDamping() const { return damping_; }

    void setStiffness(double stiffness) { stiffness_ = stiffness; }
    double getStiffness() const { return stiffness_; }

protected:
    JointType jointType_;
    MbsFrame* iFrame_ = nullptr;
    MbsFrame* jFrame_ = nullptr;
    MbsJointMotionBase* motion_ = nullptr;

    bool hasLimits_ = false;
    std::vector<double> lowerLimits_;
    std::vector<double> upperLimits_;

    double damping_ = 0.0;
    double stiffness_ = 0.0;
};

} // namespace mbs
