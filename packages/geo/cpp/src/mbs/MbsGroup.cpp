#include "MbsGroup.h"
#include "MbsConnectorBase.h"
#include "MbsJointMotion.h"
#include "../geo/ShapeStore.h"
#include <algorithm>

// OCCT headers for mass properties calculation
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <GProp_PrincipalProps.hxx>
#include <gp_Pnt.hxx>
#include <gp_Mat.hxx>
#include <TopoDS_Compound.hxx>
#include <BRep_Builder.hxx>

namespace mbs {

MbsGroup::MbsGroup(const std::string& name)
    : MbsEntityBase(EntityType::Group, name) {}

Transform MbsGroup::getGlobalTransform() const {
    Transform local = getLocalTransform();
    if (parentGroup_) {
        return parentGroup_->getGlobalTransform() * local;
    }
    return local;
}

// 零件管理
MbsParts* MbsGroup::addParts(const std::string& name) {
    auto parts = std::make_unique<MbsParts>(name);
    parts->setOwnerGroup(this);
    MbsParts* ptr = parts.get();
    parts_.push_back(std::move(parts));
    propertiesDirty_ = true;
    return ptr;
}

MbsParts* MbsGroup::getParts(const std::string& name) const {
    for (const auto& p : parts_) {
        if (p->getName() == name) {
            return p.get();
        }
    }
    return nullptr;
}

MbsParts* MbsGroup::getPartsById(uint64_t id) const {
    for (const auto& p : parts_) {
        if (p->getId() == id) {
            return p.get();
        }
    }
    return nullptr;
}

void MbsGroup::removeParts(const std::string& name) {
    auto it = std::remove_if(parts_.begin(), parts_.end(),
        [&name](const std::unique_ptr<MbsParts>& p) {
            return p->getName() == name;
        });
    parts_.erase(it, parts_.end());
    propertiesDirty_ = true;
}

// 连接器管理
void MbsGroup::addConnector(std::unique_ptr<MbsConnectorBase> connector) {
    connector->setOwnerGroup(this);
    connectors_.push_back(std::move(connector));
}

MbsConnectorBase* MbsGroup::getConnector(const std::string& name) const {
    for (const auto& c : connectors_) {
        if (c->getName() == name) {
            return c.get();
        }
    }
    return nullptr;
}

MbsConnectorBase* MbsGroup::getConnectorById(uint64_t id) const {
    for (const auto& c : connectors_) {
        if (c->getId() == id) {
            return c.get();
        }
    }
    return nullptr;
}

// 驱动管理
void MbsGroup::addMotion(std::unique_ptr<MbsJointMotionBase> motion) {
    motion->setOwnerGroup(this);
    motions_.push_back(std::move(motion));
}

MbsJointMotionBase* MbsGroup::getMotion(const std::string& name) const {
    for (const auto& m : motions_) {
        if (m->getName() == name) {
            return m.get();
        }
    }
    return nullptr;
}

// 子分组管理
void MbsGroup::addChildGroup(MbsGroup* child) {
    if (child && std::find(childGroups_.begin(), childGroups_.end(), child) == childGroups_.end()) {
        childGroups_.push_back(child);
        child->setParentGroup(this);
    }
}

void MbsGroup::removeChildGroup(MbsGroup* child) {
    auto it = std::find(childGroups_.begin(), childGroups_.end(), child);
    if (it != childGroups_.end()) {
        (*it)->setParentGroup(nullptr);
        childGroups_.erase(it);
    }
}

void MbsGroup::addConnection(const MbsGroupConnection& connection) {
    connections_.push_back(connection);
}

void MbsGroup::traverseGroups(const std::function<void(MbsGroup*)>& visitor) {
    visitor(this);
    for (auto* child : childGroups_) {
        child->traverseGroups(visitor);
    }
}

// 物理属性计算
double MbsGroup::getTotalMass() const {
    if (propertiesDirty_) {
        const_cast<MbsGroup*>(this)->calculateAggregateProperties();
    }
    return cachedMass_;
}

Vec3 MbsGroup::getCenterOfMass() const {
    if (propertiesDirty_) {
        const_cast<MbsGroup*>(this)->calculateAggregateProperties();
    }
    return cachedCom_;
}

Mat3 MbsGroup::getInertiaMatrix() const {
    if (propertiesDirty_) {
        const_cast<MbsGroup*>(this)->calculateAggregateProperties();
    }
    return cachedInertia_;
}

void MbsGroup::calculateAggregateProperties() {
    cachedMass_ = 0.0;
    cachedCom_ = Vec3::zero();
    cachedInertia_ = Mat3::identity();

    // 收集所有形状
    std::vector<std::string> allShapeIds;
    for (const auto& p : parts_) {
        const auto& ids = p->getShapeIds();
        allShapeIds.insert(allShapeIds.end(), ids.begin(), ids.end());
    }

    if (allShapeIds.empty()) {
        propertiesDirty_ = false;
        return;
    }

    // Build compound from all shapes
    TopoDS_Compound compound;
    BRep_Builder builder;
    builder.MakeCompound(compound);

    auto& store = geo::ShapeStore::instance();
    int validShapes = 0;

    for (const auto& id : allShapeIds) {
        auto shape = store.getShape(id);
        if (shape.has_value()) {
            builder.Add(compound, shape.value());
            validShapes++;
        }
    }

    if (validShapes == 0) {
        propertiesDirty_ = false;
        return;
    }

    // Calculate volume properties using OCCT
    GProp_GProps props;
    BRepGProp::VolumeProperties(compound, props);

    // Get mass (volume with density = 1.0)
    cachedMass_ = props.Mass();

    // Get center of mass
    gp_Pnt com = props.CentreOfMass();
    cachedCom_ = Vec3(com.X(), com.Y(), com.Z());

    // Get inertia matrix at center of mass
    gp_Mat mat = props.MatrixOfInertia();
    cachedInertia_.m = {
        mat.Value(1, 1), mat.Value(1, 2), mat.Value(1, 3),
        mat.Value(2, 1), mat.Value(2, 2), mat.Value(2, 3),
        mat.Value(3, 1), mat.Value(3, 2), mat.Value(3, 3)
    };

    propertiesDirty_ = false;
}

// 兼容旧接口
void MbsGroup::addShapeId(const std::string& shapeId) {
    // 添加到第一个零件，如果没有零件则创建一个
    if (parts_.empty()) {
        addParts("DefaultParts");
    }
    parts_[0]->addShapeId(shapeId);
    propertiesDirty_ = true;
}

void MbsGroup::removeShapeId(const std::string& shapeId) {
    for (auto& p : parts_) {
        p->removeShapeId(shapeId);
    }
    propertiesDirty_ = true;
}

std::vector<std::string> MbsGroup::getShapeIds() const {
    std::vector<std::string> result;
    for (const auto& p : parts_) {
        const auto& ids = p->getShapeIds();
        result.insert(result.end(), ids.begin(), ids.end());
    }
    return result;
}

} // namespace mbs
