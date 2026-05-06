// CadToolOnline - Shape storage implementation
#include "ShapeStore.h"

namespace geo {

ShapeStore& ShapeStore::instance() {
    static ShapeStore store;
    return store;
}

void ShapeStore::addShape(const std::string& id, const TopoDS_Shape& shape) {
    shapes_[id] = StoredShapeData { shape, {} };
}

void ShapeStore::addShape(const std::string& id,
                          const TopoDS_Shape& shape,
                          const std::vector<float>& faceColorsLinear) {
    shapes_[id] = StoredShapeData { shape, faceColorsLinear };
}

void ShapeStore::removeShape(const std::string& id) {
    shapes_.erase(id);
}

std::optional<TopoDS_Shape> ShapeStore::getShape(const std::string& id) const {
    auto it = shapes_.find(id);
    if (it != shapes_.end()) {
        return it->second.shape;
    }
    return std::nullopt;
}

std::optional<std::vector<float>> ShapeStore::getFaceColors(const std::string& id) const {
    auto it = shapes_.find(id);
    if (it != shapes_.end()) {
        return it->second.faceColorsLinear;
    }
    return std::nullopt;
}

bool ShapeStore::hasShape(const std::string& id) const {
    return shapes_.find(id) != shapes_.end();
}

void ShapeStore::clear() {
    shapes_.clear();
}

size_t ShapeStore::size() const {
    return shapes_.size();
}

} // namespace geo
