#include "MbsParts.h"
#include "MbsGroup.h"
#include <algorithm>

namespace mbs {

MbsParts::MbsParts(const std::string& name)
    : MbsEntityBase(EntityType::Parts, name) {}

void MbsParts::setInertia(double ixx, double iyy, double izz,
                          double ixy, double ixz, double iyz) {
    inertiaMatrix_ = Mat3(
        ixx, -ixy, -ixz,
        -ixy, iyy, -iyz,
        -ixz, -iyz, izz
    );
}

Transform MbsParts::getGlobalTransform() const {
    Transform local = getLocalTransform();
    if (ownerGroup_) {
        return ownerGroup_->getGlobalTransform() * local;
    }
    return local;
}

void MbsParts::addShapeId(const std::string& shapeId) {
    if (std::find(shapeIds_.begin(), shapeIds_.end(), shapeId) == shapeIds_.end()) {
        shapeIds_.push_back(shapeId);
    }
}

void MbsParts::removeShapeId(const std::string& shapeId) {
    auto it = std::find(shapeIds_.begin(), shapeIds_.end(), shapeId);
    if (it != shapeIds_.end()) {
        shapeIds_.erase(it);
    }
}

MbsMarker* MbsParts::addMarker(const std::string& name) {
    auto marker = std::make_unique<MbsMarker>(name);
    marker->setOwnerParts(this);
    marker->setOwnerGroup(ownerGroup_);
    MbsMarker* ptr = marker.get();
    markers_.push_back(std::move(marker));
    return ptr;
}

MbsMarker* MbsParts::getMarker(const std::string& name) const {
    for (const auto& marker : markers_) {
        if (marker->getName() == name) {
            return marker.get();
        }
    }
    return nullptr;
}

MbsMarker* MbsParts::getMarkerById(uint64_t id) const {
    for (const auto& marker : markers_) {
        if (marker->getId() == id) {
            return marker.get();
        }
    }
    return nullptr;
}

void MbsParts::removeMarker(const std::string& name) {
    auto it = std::remove_if(markers_.begin(), markers_.end(),
        [&name](const std::unique_ptr<MbsMarker>& m) {
            return m->getName() == name;
        });
    markers_.erase(it, markers_.end());
}

MbsFrame* MbsParts::addFrame(const std::string& name) {
    auto frame = std::make_unique<MbsFrame>(name);
    frame->setOwnerParts(this);
    frame->setOwnerGroup(ownerGroup_);
    MbsFrame* ptr = frame.get();
    frames_.push_back(std::move(frame));
    return ptr;
}

MbsFrame* MbsParts::getFrame(const std::string& name) const {
    for (const auto& frame : frames_) {
        if (frame->getName() == name) {
            return frame.get();
        }
    }
    return nullptr;
}

void MbsParts::calculatePropertiesFromShapes() {
    // TODO: 实现从 OCCT 形状计算物理属性
    // 需要调用 OCCT 的 GProp_GProps 等类
}

} // namespace mbs
