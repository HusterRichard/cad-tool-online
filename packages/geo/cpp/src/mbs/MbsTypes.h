#pragma once

#include <string>
#include <array>
#include <vector>
#include <memory>
#include <cmath>

namespace mbs {

// 关节类型枚举
enum class JointType {
    Revolute,      // 转动关节 (1 DOF)
    Prismatic,     // 移动关节 (1 DOF)
    Cylindrical,   // 圆柱关节 (2 DOF)
    Spherical,     // 球关节 (3 DOF)
    Universal,     // 万向关节 (2 DOF)
    Planar,        // 平面关节 (3 DOF)
    Fixed          // 固定关节 (0 DOF)
};

// 驱动类型枚举
enum class MotionType {
    Rotational,    // 旋转驱动
    Translational  // 平移驱动
};

// 实体类型枚举
enum class EntityType {
    Group,
    Parts,
    Marker,
    Frame,
    Connector,
    Motion
};

// 3D 向量
struct Vec3 {
    double x, y, z;

    Vec3() : x(0), y(0), z(0) {}
    Vec3(double x_, double y_, double z_) : x(x_), y(y_), z(z_) {}

    Vec3 operator+(const Vec3& other) const {
        return Vec3(x + other.x, y + other.y, z + other.z);
    }

    Vec3 operator-(const Vec3& other) const {
        return Vec3(x - other.x, y - other.y, z - other.z);
    }

    Vec3 operator*(double s) const {
        return Vec3(x * s, y * s, z * s);
    }

    double dot(const Vec3& other) const {
        return x * other.x + y * other.y + z * other.z;
    }

    Vec3 cross(const Vec3& other) const {
        return Vec3(
            y * other.z - z * other.y,
            z * other.x - x * other.z,
            x * other.y - y * other.x
        );
    }

    double length() const {
        return std::sqrt(x * x + y * y + z * z);
    }

    Vec3 normalized() const {
        double len = length();
        if (len < 1e-10) return Vec3(0, 0, 1);
        return Vec3(x / len, y / len, z / len);
    }

    static Vec3 zero() { return Vec3(0, 0, 0); }
    static Vec3 unitX() { return Vec3(1, 0, 0); }
    static Vec3 unitY() { return Vec3(0, 1, 0); }
    static Vec3 unitZ() { return Vec3(0, 0, 1); }
};

// 3x3 矩阵 (row-major order)
struct Mat3 {
    std::array<double, 9> m;

    Mat3() : m{1, 0, 0, 0, 1, 0, 0, 0, 1} {}

    Mat3(double m00, double m01, double m02,
         double m10, double m11, double m12,
         double m20, double m21, double m22)
        : m{m00, m01, m02, m10, m11, m12, m20, m21, m22} {}

    double operator()(int row, int col) const {
        return m[row * 3 + col];
    }

    double& operator()(int row, int col) {
        return m[row * 3 + col];
    }

    Vec3 row(int i) const {
        return Vec3(m[i * 3], m[i * 3 + 1], m[i * 3 + 2]);
    }

    Vec3 col(int i) const {
        return Vec3(m[i], m[3 + i], m[6 + i]);
    }

    Mat3 operator*(const Mat3& other) const {
        Mat3 result;
        for (int i = 0; i < 3; ++i) {
            for (int j = 0; j < 3; ++j) {
                result(i, j) = row(i).dot(other.col(j));
            }
        }
        return result;
    }

    Vec3 operator*(const Vec3& v) const {
        return Vec3(
            row(0).dot(v),
            row(1).dot(v),
            row(2).dot(v)
        );
    }

    Mat3 transposed() const {
        return Mat3(
            m[0], m[3], m[6],
            m[1], m[4], m[7],
            m[2], m[5], m[8]
        );
    }

    static Mat3 identity() { return Mat3(); }

    static Mat3 fromAxisAngle(const Vec3& axis, double angle) {
        Vec3 a = axis.normalized();
        double c = std::cos(angle);
        double s = std::sin(angle);
        double t = 1.0 - c;

        return Mat3(
            t * a.x * a.x + c,       t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y,
            t * a.x * a.y + s * a.z, t * a.y * a.y + c,       t * a.y * a.z - s * a.x,
            t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c
        );
    }
};

// 4x4 变换矩阵
struct Transform {
    Mat3 rotation;
    Vec3 translation;

    Transform() : rotation(), translation() {}
    Transform(const Mat3& r, const Vec3& t) : rotation(r), translation(t) {}

    Vec3 apply(const Vec3& p) const {
        return rotation * p + translation;
    }

    Vec3 applyInverse(const Vec3& p) const {
        return rotation.transposed() * (p - translation);
    }

    Transform operator*(const Transform& other) const {
        return Transform(
            rotation * other.rotation,
            rotation * other.translation + translation
        );
    }

    Transform inverse() const {
        Mat3 invRot = rotation.transposed();
        return Transform(invRot, invRot * translation * (-1.0));
    }

    static Transform identity() { return Transform(); }
};

// 常量定义
constexpr double OCCT_MIN_ACCURACY = 1e-6;
constexpr double OCCT_MAX_ACCURACY = 1e+6;
constexpr double PI = 3.14159265358979323846;
constexpr double PI_2 = PI * 2.0;
constexpr double PI_HALF = PI / 2.0;

// 角度转换
inline double degToRad(double deg) { return deg * PI / 180.0; }
inline double radToDeg(double rad) { return rad * 180.0 / PI; }

} // namespace mbs
