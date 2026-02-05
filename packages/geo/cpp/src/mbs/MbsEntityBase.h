#pragma once

#include "MbsTypes.h"
#include <string>
#include <memory>
#include <atomic>

namespace mbs {

// 前向声明
class MbsGroup;

// MBS 实体基类
class MbsEntityBase {
public:
    explicit MbsEntityBase(EntityType type, const std::string& name = "");
    virtual ~MbsEntityBase() = default;

    // 禁止拷贝
    MbsEntityBase(const MbsEntityBase&) = delete;
    MbsEntityBase& operator=(const MbsEntityBase&) = delete;

    // 允许移动
    MbsEntityBase(MbsEntityBase&&) = default;
    MbsEntityBase& operator=(MbsEntityBase&&) = default;

    // 基本属性
    uint64_t getId() const { return id_; }
    EntityType getType() const { return type_; }
    const std::string& getName() const { return name_; }
    void setName(const std::string& name) { name_ = name; }

    // 所属分组
    MbsGroup* getOwnerGroup() const { return ownerGroup_; }
    void setOwnerGroup(MbsGroup* group) { ownerGroup_ = group; }

    // 启用/禁用
    bool isEnabled() const { return enabled_; }
    void setEnabled(bool enabled) { enabled_ = enabled; }

    // 类型检查
    template<typename T>
    bool is() const { return dynamic_cast<const T*>(this) != nullptr; }

    template<typename T>
    T* as() { return dynamic_cast<T*>(this); }

    template<typename T>
    const T* as() const { return dynamic_cast<const T*>(this); }

protected:
    uint64_t id_;
    EntityType type_;
    std::string name_;
    MbsGroup* ownerGroup_ = nullptr;
    bool enabled_ = true;

private:
    static std::atomic<uint64_t> nextId_;
};

} // namespace mbs
