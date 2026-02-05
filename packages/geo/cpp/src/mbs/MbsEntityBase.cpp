#include "MbsEntityBase.h"

namespace mbs {

std::atomic<uint64_t> MbsEntityBase::nextId_{1};

MbsEntityBase::MbsEntityBase(EntityType type, const std::string& name)
    : id_(nextId_++), type_(type), name_(name) {
    if (name_.empty()) {
        name_ = "Entity_" + std::to_string(id_);
    }
}

} // namespace mbs
