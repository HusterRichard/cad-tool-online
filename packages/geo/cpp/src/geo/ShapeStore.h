// CadToolOnline - Shape storage for managing TopoDS_Shape objects
#pragma once

#include <TopoDS_Shape.hxx>
#include <string>
#include <unordered_map>
#include <optional>
#include <vector>

namespace geo {

struct StoredShapeData {
    TopoDS_Shape shape;
    std::vector<float> faceColorsLinear;
};

// Singleton store for TopoDS_Shape objects, accessed by string ID
class ShapeStore {
public:
    static ShapeStore& instance();

    void addShape(const std::string& id, const TopoDS_Shape& shape);
    void addShape(const std::string& id,
                  const TopoDS_Shape& shape,
                  const std::vector<float>& faceColorsLinear);
    void removeShape(const std::string& id);
    std::optional<TopoDS_Shape> getShape(const std::string& id) const;
    std::optional<std::vector<float>> getFaceColors(const std::string& id) const;
    bool hasShape(const std::string& id) const;
    void clear();
    size_t size() const;

private:
    ShapeStore() = default;
    ~ShapeStore() = default;
    ShapeStore(const ShapeStore&) = delete;
    ShapeStore& operator=(const ShapeStore&) = delete;

    std::unordered_map<std::string, StoredShapeData> shapes_;
};

} // namespace geo
