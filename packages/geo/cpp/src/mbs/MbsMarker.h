#pragma once

#include "MbsEntityBase.h"
#include "MbsTypes.h"

namespace mbs {

// 前向声明
class MbsParts;

// MbsMarker - 标记点，定义局部坐标系
class MbsMarker : public MbsEntityBase {
public:
    explicit MbsMarker(const std::string& name = "");
    ~MbsMarker() override = default;

    // 位置和方向
    const Vec3& getPosition() const { return position_; }
    void setPosition(const Vec3& pos) { position_ = pos; }
    void setPosition(double x, double y, double z) { position_ = Vec3(x, y, z); }

    const Mat3& getOrientation() const { return orientation_; }
    void setOrientation(const Mat3& orient) { orientation_ = orient; }

    // 从轴向量设置方向
    void setOrientationFromAxes(const Vec3& xAxis, const Vec3& yAxis, const Vec3& zAxis);
    void setOrientationFromZAxis(const Vec3& zAxis);

    // 获取局部坐标轴
    Vec3 getXAxis() const { return orientation_.col(0); }
    Vec3 getYAxis() const { return orientation_.col(1); }
    Vec3 getZAxis() const { return orientation_.col(2); }

    // 变换
    Transform getLocalTransform() const { return Transform(orientation_, position_); }
    Transform getGlobalTransform() const;

    // 所属零件
    MbsParts* getOwnerParts() const { return ownerParts_; }
    void setOwnerParts(MbsParts* parts) { ownerParts_ = parts; }

    // 坐标转换
    Vec3 toLocal(const Vec3& globalPoint) const;
    Vec3 toGlobal(const Vec3& localPoint) const;

private:
    Vec3 position_;
    Mat3 orientation_;
    MbsParts* ownerParts_ = nullptr;
};

// MbsFrame - 参考坐标系，用于定义关节连接点
class MbsFrame : public MbsMarker {
public:
    explicit MbsFrame(const std::string& name = "");
    ~MbsFrame() override = default;

    // 关联的连接器
    void setConnectorId(uint64_t id) { connectorId_ = id; }
    uint64_t getConnectorId() const { return connectorId_; }

    // 是否为主 Frame (I-Frame) 或从 Frame (J-Frame)
    bool isPrimaryFrame() const { return isPrimary_; }
    void setPrimaryFrame(bool primary) { isPrimary_ = primary; }

private:
    uint64_t connectorId_ = 0;
    bool isPrimary_ = true;
};

} // namespace mbs
