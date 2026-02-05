#include "MbsMarker.h"
#include "MbsParts.h"

namespace mbs {

MbsMarker::MbsMarker(const std::string& name)
    : MbsEntityBase(EntityType::Marker, name) {}

void MbsMarker::setOrientationFromAxes(const Vec3& xAxis, const Vec3& yAxis, const Vec3& zAxis) {
    Vec3 x = xAxis.normalized();
    Vec3 y = yAxis.normalized();
    Vec3 z = zAxis.normalized();
    orientation_ = Mat3(
        x.x, y.x, z.x,
        x.y, y.y, z.y,
        x.z, y.z, z.z
    );
}

void MbsMarker::setOrientationFromZAxis(const Vec3& zAxis) {
    Vec3 z = zAxis.normalized();

    // 选择一个不平行于 z 的向量来计算 x
    Vec3 ref = (std::abs(z.z) < 0.9) ? Vec3::unitZ() : Vec3::unitX();
    Vec3 x = ref.cross(z).normalized();
    Vec3 y = z.cross(x).normalized();

    setOrientationFromAxes(x, y, z);
}

Transform MbsMarker::getGlobalTransform() const {
    Transform local = getLocalTransform();
    if (ownerParts_) {
        return ownerParts_->getGlobalTransform() * local;
    }
    return local;
}

Vec3 MbsMarker::toLocal(const Vec3& globalPoint) const {
    return getGlobalTransform().applyInverse(globalPoint);
}

Vec3 MbsMarker::toGlobal(const Vec3& localPoint) const {
    return getGlobalTransform().apply(localPoint);
}

// MbsFrame 实现
MbsFrame::MbsFrame(const std::string& name)
    : MbsMarker(name) {
    type_ = EntityType::Frame;
}

} // namespace mbs
