#include "MbsConnectorBase.h"

namespace mbs {

MbsConnectorBase::MbsConnectorBase(JointType type, const std::string& name)
    : MbsEntityBase(EntityType::Connector, name), jointType_(type) {}

void MbsConnectorBase::setIFrame(MbsFrame* frame) {
    iFrame_ = frame;
    if (frame) {
        frame->setConnectorId(getId());
        frame->setPrimaryFrame(true);
    }
}

void MbsConnectorBase::setJFrame(MbsFrame* frame) {
    jFrame_ = frame;
    if (frame) {
        frame->setConnectorId(getId());
        frame->setPrimaryFrame(false);
    }
}

} // namespace mbs
