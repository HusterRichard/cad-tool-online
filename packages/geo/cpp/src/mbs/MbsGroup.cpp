#include "MbsGroup.h"
#include <algorithm>

namespace mbs {

MbsGroup::MbsGroup(const std::string& name) : name_(name) {}

MbsGroup::~MbsGroup() = default;

void MbsGroup::addShapeId(const std::string& shapeId) {
    if (std::find(shapeIds_.begin(), shapeIds_.end(), shapeId) == shapeIds_.end()) {
        shapeIds_.push_back(shapeId);
    }
}

void MbsGroup::removeShapeId(const std::string& shapeId) {
    auto it = std::find(shapeIds_.begin(), shapeIds_.end(), shapeId);
    if (it != shapeIds_.end()) {
        shapeIds_.erase(it);
    }
}

void MbsGroup::calculateProperties() {
    // TODO: Implement using OCCT GProp_GProps
    // This will calculate mass, center of mass, and inertia matrix
    // from the shapes associated with this group
}

} // namespace mbs
