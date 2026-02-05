#pragma once

#include <string>
#include <array>
#include <vector>

namespace mbs {

struct Vec3 {
    double x, y, z;

    Vec3() : x(0), y(0), z(0) {}
    Vec3(double x_, double y_, double z_) : x(x_), y(y_), z(z_) {}
};

struct Mat3 {
    std::array<double, 9> m;

    Mat3() : m{1, 0, 0, 0, 1, 0, 0, 0, 1} {}
};

class MbsGroup {
public:
    MbsGroup(const std::string& name);
    ~MbsGroup();

    const std::string& getName() const { return name_; }
    void setName(const std::string& name) { name_ = name; }

    double getMass() const { return mass_; }
    Vec3 getCenterOfMass() const { return centerOfMass_; }
    Mat3 getInertiaMatrix() const { return inertiaMatrix_; }

    void addShapeId(const std::string& shapeId);
    void removeShapeId(const std::string& shapeId);
    const std::vector<std::string>& getShapeIds() const { return shapeIds_; }

    void calculateProperties();

private:
    std::string name_;
    double mass_ = 0.0;
    Vec3 centerOfMass_;
    Mat3 inertiaMatrix_;
    std::vector<std::string> shapeIds_;
};

} // namespace mbs
