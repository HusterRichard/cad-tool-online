#include "MbsJoints.h"
#include <cmath>

namespace mbs {

// ============================================================================
// MbsRevolute 实现
// ============================================================================
MbsRevolute::MbsRevolute(const std::string& name)
    : MbsConnectorBase(JointType::Revolute, name) {
    lowerLimits_ = {-PI};
    upperLimits_ = {PI};
}

std::vector<double> MbsRevolute::getJointPosition() const {
    return {angle_};
}

std::vector<double> MbsRevolute::getJointVelocity() const {
    return {angularVelocity_};
}

void MbsRevolute::setJointPosition(const std::vector<double>& pos) {
    if (!pos.empty()) angle_ = pos[0];
}

void MbsRevolute::setJointVelocity(const std::vector<double>& vel) {
    if (!vel.empty()) angularVelocity_ = vel[0];
}

Transform MbsRevolute::getRelativeTransform() const {
    Mat3 rot = Mat3::fromAxisAngle(Vec3::unitZ(), angle_);
    return Transform(rot, Vec3::zero());
}

// ============================================================================
// MbsPrismatic 实现
// ============================================================================
MbsPrismatic::MbsPrismatic(const std::string& name)
    : MbsConnectorBase(JointType::Prismatic, name) {
    lowerLimits_ = {-1000.0};
    upperLimits_ = {1000.0};
}

std::vector<double> MbsPrismatic::getJointPosition() const {
    return {displacement_};
}

std::vector<double> MbsPrismatic::getJointVelocity() const {
    return {linearVelocity_};
}

void MbsPrismatic::setJointPosition(const std::vector<double>& pos) {
    if (!pos.empty()) displacement_ = pos[0];
}

void MbsPrismatic::setJointVelocity(const std::vector<double>& vel) {
    if (!vel.empty()) linearVelocity_ = vel[0];
}

Transform MbsPrismatic::getRelativeTransform() const {
    return Transform(Mat3::identity(), Vec3(0, 0, displacement_));
}

// ============================================================================
// MbsCylindrical 实现
// ============================================================================
MbsCylindrical::MbsCylindrical(const std::string& name)
    : MbsConnectorBase(JointType::Cylindrical, name) {
    lowerLimits_ = {-PI, -1000.0};
    upperLimits_ = {PI, 1000.0};
}

std::vector<double> MbsCylindrical::getJointPosition() const {
    return {angle_, displacement_};
}

std::vector<double> MbsCylindrical::getJointVelocity() const {
    return {angularVelocity_, linearVelocity_};
}

void MbsCylindrical::setJointPosition(const std::vector<double>& pos) {
    if (pos.size() >= 1) angle_ = pos[0];
    if (pos.size() >= 2) displacement_ = pos[1];
}

void MbsCylindrical::setJointVelocity(const std::vector<double>& vel) {
    if (vel.size() >= 1) angularVelocity_ = vel[0];
    if (vel.size() >= 2) linearVelocity_ = vel[1];
}

Transform MbsCylindrical::getRelativeTransform() const {
    Mat3 rot = Mat3::fromAxisAngle(Vec3::unitZ(), angle_);
    return Transform(rot, Vec3(0, 0, displacement_));
}

// ============================================================================
// MbsSpherical 实现
// ============================================================================
MbsSpherical::MbsSpherical(const std::string& name)
    : MbsConnectorBase(JointType::Spherical, name) {
    lowerLimits_ = {-PI, -PI_HALF, -PI};
    upperLimits_ = {PI, PI_HALF, PI};
}

std::vector<double> MbsSpherical::getJointPosition() const {
    return {alpha_, beta_, gamma_};
}

std::vector<double> MbsSpherical::getJointVelocity() const {
    return {angularVelocity_.x, angularVelocity_.y, angularVelocity_.z};
}

void MbsSpherical::setJointPosition(const std::vector<double>& pos) {
    if (pos.size() >= 1) alpha_ = pos[0];
    if (pos.size() >= 2) beta_ = pos[1];
    if (pos.size() >= 3) gamma_ = pos[2];
}

void MbsSpherical::setJointVelocity(const std::vector<double>& vel) {
    if (vel.size() >= 3) {
        angularVelocity_ = Vec3(vel[0], vel[1], vel[2]);
    }
}

void MbsSpherical::setEulerAngles(double alpha, double beta, double gamma) {
    alpha_ = alpha;
    beta_ = beta;
    gamma_ = gamma;
}

void MbsSpherical::getEulerAngles(double& alpha, double& beta, double& gamma) const {
    alpha = alpha_;
    beta = beta_;
    gamma = gamma_;
}

Transform MbsSpherical::getRelativeTransform() const {
    // ZYX 欧拉角顺序
    Mat3 rz = Mat3::fromAxisAngle(Vec3::unitZ(), alpha_);
    Mat3 ry = Mat3::fromAxisAngle(Vec3::unitY(), beta_);
    Mat3 rx = Mat3::fromAxisAngle(Vec3::unitX(), gamma_);
    return Transform(rz * ry * rx, Vec3::zero());
}

// ============================================================================
// MbsUniversal 实现
// ============================================================================
MbsUniversal::MbsUniversal(const std::string& name)
    : MbsConnectorBase(JointType::Universal, name) {
    lowerLimits_ = {-PI_HALF, -PI_HALF};
    upperLimits_ = {PI_HALF, PI_HALF};
}

std::vector<double> MbsUniversal::getJointPosition() const {
    return {angleX_, angleY_};
}

std::vector<double> MbsUniversal::getJointVelocity() const {
    return {angularVelocityX_, angularVelocityY_};
}

void MbsUniversal::setJointPosition(const std::vector<double>& pos) {
    if (pos.size() >= 1) angleX_ = pos[0];
    if (pos.size() >= 2) angleY_ = pos[1];
}

void MbsUniversal::setJointVelocity(const std::vector<double>& vel) {
    if (vel.size() >= 1) angularVelocityX_ = vel[0];
    if (vel.size() >= 2) angularVelocityY_ = vel[1];
}

Transform MbsUniversal::getRelativeTransform() const {
    Mat3 rx = Mat3::fromAxisAngle(Vec3::unitX(), angleX_);
    Mat3 ry = Mat3::fromAxisAngle(Vec3::unitY(), angleY_);
    return Transform(rx * ry, Vec3::zero());
}

// ============================================================================
// MbsPlanar 实现
// ============================================================================
MbsPlanar::MbsPlanar(const std::string& name)
    : MbsConnectorBase(JointType::Planar, name) {
    lowerLimits_ = {-1000.0, -1000.0, -PI};
    upperLimits_ = {1000.0, 1000.0, PI};
}

std::vector<double> MbsPlanar::getJointPosition() const {
    return {x_, y_, angle_};
}

std::vector<double> MbsPlanar::getJointVelocity() const {
    return {velocityX_, velocityY_, angularVelocity_};
}

void MbsPlanar::setJointPosition(const std::vector<double>& pos) {
    if (pos.size() >= 1) x_ = pos[0];
    if (pos.size() >= 2) y_ = pos[1];
    if (pos.size() >= 3) angle_ = pos[2];
}

void MbsPlanar::setJointVelocity(const std::vector<double>& vel) {
    if (vel.size() >= 1) velocityX_ = vel[0];
    if (vel.size() >= 2) velocityY_ = vel[1];
    if (vel.size() >= 3) angularVelocity_ = vel[2];
}

Transform MbsPlanar::getRelativeTransform() const {
    Mat3 rot = Mat3::fromAxisAngle(Vec3::unitZ(), angle_);
    return Transform(rot, Vec3(x_, y_, 0));
}

// ============================================================================
// MbsFixed 实现
// ============================================================================
MbsFixed::MbsFixed(const std::string& name)
    : MbsConnectorBase(JointType::Fixed, name) {}

Transform MbsFixed::getRelativeTransform() const {
    return Transform::identity();
}

} // namespace mbs
