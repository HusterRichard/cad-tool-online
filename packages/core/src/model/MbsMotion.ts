import { MotionType } from '../types';

export interface IMbsMotion {
    id: string;
    name: string;
    type: MotionType;
    jointId: string;
    expression: string;
}

export class MbsMotion implements IMbsMotion {
    id: string;
    name: string;
    type: MotionType;
    jointId: string;
    expression: string;

    constructor(
        id: string,
        name: string,
        type: MotionType,
        jointId: string,
        expression: string = '0'
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.jointId = jointId;
        this.expression = expression;
    }
}
