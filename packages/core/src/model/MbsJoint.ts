import { JointType } from '../types';

export interface IMbsJoint {
    id: string;
    name: string;
    type: JointType;
    iMarkerId: string;
    jMarkerId: string;
}

export class MbsJoint implements IMbsJoint {
    id: string;
    name: string;
    type: JointType;
    iMarkerId: string;
    jMarkerId: string;

    constructor(
        id: string,
        name: string,
        type: JointType,
        iMarkerId: string,
        jMarkerId: string
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.iMarkerId = iMarkerId;
        this.jMarkerId = jMarkerId;
    }
}

export class MbsRevolute extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Revolute, iMarkerId, jMarkerId);
    }
}

export class MbsPrismatic extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Prismatic, iMarkerId, jMarkerId);
    }
}

export class MbsCylindrical extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Cylindrical, iMarkerId, jMarkerId);
    }
}

export class MbsSpherical extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Spherical, iMarkerId, jMarkerId);
    }
}

export class MbsUniversal extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Universal, iMarkerId, jMarkerId);
    }
}

export class MbsPlanar extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Planar, iMarkerId, jMarkerId);
    }
}

export class MbsFixed extends MbsJoint {
    constructor(id: string, name: string, iMarkerId: string, jMarkerId: string) {
        super(id, name, JointType.Fixed, iMarkerId, jMarkerId);
    }
}
