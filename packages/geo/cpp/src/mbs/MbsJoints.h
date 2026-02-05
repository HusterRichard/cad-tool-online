#pragma once

#include "MbsConnectorBase.h"

namespace mbs {

// ============================================================================
// MbsRevolute - 转动关节 (1 DOF: 绕 Z 轴旋转)
// ============================================================================
class MbsRevolute : public MbsConnectorBase {
public:
    explicit MbsRevolute(const std::string& name = "");
    ~MbsRevolute() override = default;

    int getDegreesOfFreedom() const override { return 1; }

    // 关节状态
    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 单值接口
    double getAngle() const { return angle_; }
    void setAngle(double angle) { angle_ = angle; }
    double getAngularVelocity() const { return angularVelocity_; }
    void setAngularVelocity(double vel) { angularVelocity_ = vel; }

    Transform getRelativeTransform() const override;

private:
    double angle_ = 0.0;           // 旋转角度 (rad)
    double angularVelocity_ = 0.0; // 角速度 (rad/s)
};

// ============================================================================
// MbsPrismatic - 移动关节 (1 DOF: 沿 Z 轴平移)
// ============================================================================
class MbsPrismatic : public MbsConnectorBase {
public:
    explicit MbsPrismatic(const std::string& name = "");
    ~MbsPrismatic() override = default;

    int getDegreesOfFreedom() const override { return 1; }

    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 单值接口
    double getDisplacement() const { return displacement_; }
    void setDisplacement(double disp) { displacement_ = disp; }
    double getLinearVelocity() const { return linearVelocity_; }
    void setLinearVelocity(double vel) { linearVelocity_ = vel; }

    Transform getRelativeTransform() const override;

private:
    double displacement_ = 0.0;   // 位移
    double linearVelocity_ = 0.0; // 线速度
};

// ============================================================================
// MbsCylindrical - 圆柱关节 (2 DOF: 绕 Z 轴旋转 + 沿 Z 轴平移)
// ============================================================================
class MbsCylindrical : public MbsConnectorBase {
public:
    explicit MbsCylindrical(const std::string& name = "");
    ~MbsCylindrical() override = default;

    int getDegreesOfFreedom() const override { return 2; }

    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 分量接口
    double getAngle() const { return angle_; }
    void setAngle(double angle) { angle_ = angle; }
    double getDisplacement() const { return displacement_; }
    void setDisplacement(double disp) { displacement_ = disp; }

    Transform getRelativeTransform() const override;

private:
    double angle_ = 0.0;
    double displacement_ = 0.0;
    double angularVelocity_ = 0.0;
    double linearVelocity_ = 0.0;
};

// ============================================================================
// MbsSpherical - 球关节 (3 DOF: 三个旋转自由度，使用欧拉角 ZYX)
// ============================================================================
class MbsSpherical : public MbsConnectorBase {
public:
    explicit MbsSpherical(const std::string& name = "");
    ~MbsSpherical() override = default;

    int getDegreesOfFreedom() const override { return 3; }

    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 欧拉角接口 (ZYX 顺序)
    void setEulerAngles(double alpha, double beta, double gamma);
    void getEulerAngles(double& alpha, double& beta, double& gamma) const;

    Transform getRelativeTransform() const override;

private:
    double alpha_ = 0.0; // 绕 Z 轴
    double beta_ = 0.0;  // 绕 Y 轴
    double gamma_ = 0.0; // 绕 X 轴
    Vec3 angularVelocity_;
};

// ============================================================================
// MbsUniversal - 万向关节 (2 DOF: 绕 X 轴和 Y 轴旋转)
// ============================================================================
class MbsUniversal : public MbsConnectorBase {
public:
    explicit MbsUniversal(const std::string& name = "");
    ~MbsUniversal() override = default;

    int getDegreesOfFreedom() const override { return 2; }

    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 分量接口
    double getAngleX() const { return angleX_; }
    void setAngleX(double angle) { angleX_ = angle; }
    double getAngleY() const { return angleY_; }
    void setAngleY(double angle) { angleY_ = angle; }

    Transform getRelativeTransform() const override;

private:
    double angleX_ = 0.0;
    double angleY_ = 0.0;
    double angularVelocityX_ = 0.0;
    double angularVelocityY_ = 0.0;
};

// ============================================================================
// MbsPlanar - 平面关节 (3 DOF: XY 平面内平移 + 绕 Z 轴旋转)
// ============================================================================
class MbsPlanar : public MbsConnectorBase {
public:
    explicit MbsPlanar(const std::string& name = "");
    ~MbsPlanar() override = default;

    int getDegreesOfFreedom() const override { return 3; }

    std::vector<double> getJointPosition() const override;
    std::vector<double> getJointVelocity() const override;
    void setJointPosition(const std::vector<double>& pos) override;
    void setJointVelocity(const std::vector<double>& vel) override;

    // 分量接口
    double getX() const { return x_; }
    void setX(double x) { x_ = x; }
    double getY() const { return y_; }
    void setY(double y) { y_ = y; }
    double getAngle() const { return angle_; }
    void setAngle(double angle) { angle_ = angle; }

    Transform getRelativeTransform() const override;

private:
    double x_ = 0.0;
    double y_ = 0.0;
    double angle_ = 0.0;
    double velocityX_ = 0.0;
    double velocityY_ = 0.0;
    double angularVelocity_ = 0.0;
};

// ============================================================================
// MbsFixed - 固定关节 (0 DOF)
// ============================================================================
class MbsFixed : public MbsConnectorBase {
public:
    explicit MbsFixed(const std::string& name = "");
    ~MbsFixed() override = default;

    int getDegreesOfFreedom() const override { return 0; }

    std::vector<double> getJointPosition() const override { return {}; }
    std::vector<double> getJointVelocity() const override { return {}; }
    void setJointPosition(const std::vector<double>&) override {}
    void setJointVelocity(const std::vector<double>&) override {}

    Transform getRelativeTransform() const override;
};

} // namespace mbs
