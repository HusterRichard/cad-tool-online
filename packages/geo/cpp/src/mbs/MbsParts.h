#pragma once

#include "MbsEntityBase.h"
#include "MbsMarker.h"
#include "MbsTypes.h"
#include <vector>
#include <memory>
#include <map>

namespace mbs {

// 前向声明
class MbsGroup;
class MbsConnectorBase;

// MbsParts - 刚体零件，包含几何形状和物理属性
class MbsParts : public MbsEntityBase {
public:
    explicit MbsParts(const std::string& name = "");
    ~MbsParts() override = default;

    // 物理属性
    double getMass() const { return mass_; }
    void setMass(double mass) { mass_ = mass; }

    const Vec3& getCenterOfMass() const { return centerOfMass_; }
    void setCenterOfMass(const Vec3& com) { centerOfMass_ = com; }
    void setCenterOfMass(double x, double y, double z) { centerOfMass_ = Vec3(x, y, z); }

    const Mat3& getInertiaMatrix() const { return inertiaMatrix_; }
    void setInertiaMatrix(const Mat3& inertia) { inertiaMatrix_ = inertia; }

    // 惯性张量分量设置
    void setInertia(double ixx, double iyy, double izz,
                    double ixy = 0, double ixz = 0, double iyz = 0);

    // 位置和方向
    const Vec3& getPosition() const { return position_; }
    void setPosition(const Vec3& pos) { position_ = pos; }
    void setPosition(double x, double y, double z) { position_ = Vec3(x, y, z); }

    const Mat3& getOrientation() const { return orientation_; }
    void setOrientation(const Mat3& orient) { orientation_ = orient; }

    // 变换
    Transform getLocalTransform() const { return Transform(orientation_, position_); }
    Transform getGlobalTransform() const;

    // 几何形状 ID 管理
    void addShapeId(const std::string& shapeId);
    void removeShapeId(const std::string& shapeId);
    const std::vector<std::string>& getShapeIds() const { return shapeIds_; }
    void clearShapeIds() { shapeIds_.clear(); }

    // Marker 管理
    MbsMarker* addMarker(const std::string& name = "");
    MbsMarker* getMarker(const std::string& name) const;
    MbsMarker* getMarkerById(uint64_t id) const;
    const std::vector<std::unique_ptr<MbsMarker>>& getMarkers() const { return markers_; }
    size_t getMarkerCount() const { return markers_.size(); }
    void removeMarker(const std::string& name);

    // Frame 管理
    MbsFrame* addFrame(const std::string& name = "");
    MbsFrame* getFrame(const std::string& name) const;
    const std::vector<std::unique_ptr<MbsFrame>>& getFrames() const { return frames_; }
    size_t getFrameCount() const { return frames_.size(); }

    // 从几何形状计算物理属性
    void calculatePropertiesFromShapes();

    // 是否为地面/固定零件
    bool isGround() const { return isGround_; }
    void setGround(bool ground) { isGround_ = ground; }

private:
    // 物理属性
    double mass_ = 0.0;
    Vec3 centerOfMass_;
    Mat3 inertiaMatrix_;

    // 位置和方向
    Vec3 position_;
    Mat3 orientation_;

    // 几何形状
    std::vector<std::string> shapeIds_;

    // Markers 和 Frames
    std::vector<std::unique_ptr<MbsMarker>> markers_;
    std::vector<std::unique_ptr<MbsFrame>> frames_;

    // 是否为地面
    bool isGround_ = false;
};

} // namespace mbs
