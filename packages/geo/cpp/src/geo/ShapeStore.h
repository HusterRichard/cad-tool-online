// CadToolOnline - Shape storage for managing TopoDS_Shape objects
#pragma once

#include <TopoDS_Shape.hxx>
#include <string>
#include <unordered_map>
#include <optional>

namespace geo {

// Singleton store for TopoDS_Shape objects, accessed by string ID
class ShapeStore {
public:
    static ShapeStore& instance();

    void addShape(const std::string& id, const TopoDS_Shape& shape);
    void removeShape(const std::string& id);
    std::optional<TopoDS_Shape> getShape(const std::string& id) const;
    bool hasShape(const std::string& id) const;
    void clear();
    size_t size() const;

private:
    ShapeStore() = default;
    ~ShapeStore() = default;
    ShapeStore(const ShapeStore&) = delete;
    ShapeStore& operator=(const ShapeStore&) = delete;

    std::unordered_map<std::string, TopoDS_Shape> shapes_;
};

} // namespace geo
