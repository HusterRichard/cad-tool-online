#pragma once

#include "MbsEntityBase.h"
#include "MbsParts.h"
#include "MbsTypes.h"
#include <vector>
#include <memory>
#include <map>

namespace mbs {

// 前向声明
class MbsConnectorBase;
class MbsJointMotionBase;

// MbsGroupConnection - 分组之间的连接关系
struct MbsGroupConnection {
    uint64_t connectorId;      // 连接器 ID
    MbsGroup* parentGroup;     // 父分组
    MbsGroup* childGroup;      // 子分组
    MbsFrame* parentFrame;     // 父分组上的 Frame
    MbsFrame* childFrame;      // 子分组上的 Frame
};

// MbsGroup - 多体系统分组，包含零件和连接器
class MbsGroup : public MbsEntityBase {
public:
    explicit MbsGroup(const std::string& name = "");
    ~MbsGroup() override = default;

    // 物理属性（聚合所有零件）
    double getTotalMass() const;
    Vec3 getCenterOfMass() const;
    Mat3 getInertiaMatrix() const;

    // 位置和方向
    const Vec3& getPosition() const { return position_; }
    void setPosition(const Vec3& pos) { position_ = pos; }
    void setPosition(double x, double y, double z) { position_ = Vec3(x, y, z); }

    const Mat3& getOrientation() const { return orientation_; }
    void setOrientation(const Mat3& orient) { orientation_ = orient; }

    // 变换
    Transform getLocalTransform() const { return Transform(orientation_, position_); }
    Transform getGlobalTransform() const;

    // 零件管理
    MbsParts* addParts(const std::string& name = "");
    MbsParts* getParts(const std::string& name) const;
    MbsParts* getPartsById(uint64_t id) const;
    const std::vector<std::unique_ptr<MbsParts>>& getAllParts() const { return parts_; }
    size_t getPartsCount() const { return parts_.size(); }
    void removeParts(const std::string& name);

    // 连接器管理
    void addConnector(std::unique_ptr<MbsConnectorBase> connector);
    MbsConnectorBase* getConnector(const std::string& name) const;
    MbsConnectorBase* getConnectorById(uint64_t id) const;
    const std::vector<std::unique_ptr<MbsConnectorBase>>& getConnectors() const { return connectors_; }
    size_t getConnectorCount() const { return connectors_.size(); }

    // 驱动管理
    void addMotion(std::unique_ptr<MbsJointMotionBase> motion);
    MbsJointMotionBase* getMotion(const std::string& name) const;
    const std::vector<std::unique_ptr<MbsJointMotionBase>>& getMotions() const { return motions_; }
    size_t getMotionCount() const { return motions_.size(); }

    // 子分组管理
    void addChildGroup(MbsGroup* child);
    void removeChildGroup(MbsGroup* child);
    const std::vector<MbsGroup*>& getChildGroups() const { return childGroups_; }
    MbsGroup* getParentGroup() const { return parentGroup_; }
    void setParentGroup(MbsGroup* parent) { parentGroup_ = parent; }

    // 连接关系
    void addConnection(const MbsGroupConnection& connection);
    const std::vector<MbsGroupConnection>& getConnections() const { return connections_; }

    // 是否为根分组
    bool isRoot() const { return parentGroup_ == nullptr; }

    // 计算聚合属性
    void calculateAggregateProperties();

    // 遍历所有子分组
    void traverseGroups(const std::function<void(MbsGroup*)>& visitor);

    // 兼容旧接口
    double getMass() const { return getTotalMass(); }
    void addShapeId(const std::string& shapeId);
    void removeShapeId(const std::string& shapeId);
    std::vector<std::string> getShapeIds() const;
    void calculateProperties() { calculateAggregateProperties(); }

private:
    // 位置和方向
    Vec3 position_;
    Mat3 orientation_;

    // 零件
    std::vector<std::unique_ptr<MbsParts>> parts_;

    // 连接器
    std::vector<std::unique_ptr<MbsConnectorBase>> connectors_;

    // 驱动
    std::vector<std::unique_ptr<MbsJointMotionBase>> motions_;

    // 分组层级
    MbsGroup* parentGroup_ = nullptr;
    std::vector<MbsGroup*> childGroups_;

    // 连接关系
    std::vector<MbsGroupConnection> connections_;

    // 缓存的聚合属性
    mutable double cachedMass_ = 0.0;
    mutable Vec3 cachedCom_;
    mutable Mat3 cachedInertia_;
    mutable bool propertiesDirty_ = true;
};

} // namespace mbs
