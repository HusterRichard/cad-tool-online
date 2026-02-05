/**
 * MBS (Multi-Body System) 单元测试
 * 测试 MBS 类型定义和 WASM 绑定
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    MbsJointType,
    MbsMotionType,
    MbsEntityType,
    MbsMotionFunctionType,
    JOINT_DOF_INFO,
} from '../src/mbs-types';

describe('MBS Types', () => {
    describe('MbsJointType enum', () => {
        it('should have correct values for all joint types', () => {
            expect(MbsJointType.Revolute).toBe(0);
            expect(MbsJointType.Prismatic).toBe(1);
            expect(MbsJointType.Cylindrical).toBe(2);
            expect(MbsJointType.Spherical).toBe(3);
            expect(MbsJointType.Universal).toBe(4);
            expect(MbsJointType.Planar).toBe(5);
            expect(MbsJointType.Fixed).toBe(6);
        });
    });

    describe('MbsMotionType enum', () => {
        it('should have correct values', () => {
            expect(MbsMotionType.Rotational).toBe(0);
            expect(MbsMotionType.Translational).toBe(1);
        });
    });

    describe('MbsEntityType enum', () => {
        it('should have correct values', () => {
            expect(MbsEntityType.Group).toBe(0);
            expect(MbsEntityType.Parts).toBe(1);
            expect(MbsEntityType.Marker).toBe(2);
            expect(MbsEntityType.Frame).toBe(3);
            expect(MbsEntityType.Connector).toBe(4);
            expect(MbsEntityType.Motion).toBe(5);
        });
    });

    describe('MbsMotionFunctionType enum', () => {
        it('should have correct values', () => {
            expect(MbsMotionFunctionType.Constant).toBe(0);
            expect(MbsMotionFunctionType.Step).toBe(1);
            expect(MbsMotionFunctionType.Ramp).toBe(2);
            expect(MbsMotionFunctionType.Harmonic).toBe(3);
            expect(MbsMotionFunctionType.Expression).toBe(4);
        });
    });

    describe('JOINT_DOF_INFO', () => {
        it('should have correct DOF for Revolute joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Revolute].dof).toBe(1);
        });

        it('should have correct DOF for Prismatic joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Prismatic].dof).toBe(1);
        });

        it('should have correct DOF for Cylindrical joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Cylindrical].dof).toBe(2);
        });

        it('should have correct DOF for Spherical joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Spherical].dof).toBe(3);
        });

        it('should have correct DOF for Universal joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Universal].dof).toBe(2);
        });

        it('should have correct DOF for Planar joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Planar].dof).toBe(3);
        });

        it('should have correct DOF for Fixed joint', () => {
            expect(JOINT_DOF_INFO[MbsJointType.Fixed].dof).toBe(0);
        });
    });
});

// WASM 绑定测试 (需要 WASM 模块加载后运行)
describe.skip('MBS WASM Bindings', () => {
    let wasm: any;

    beforeAll(async () => {
        // TODO: 加载 WASM 模块
        // wasm = await loadWasmModule();
    });

    describe('MbsMarker', () => {
        it('should create a marker with default name', () => {
            const marker = new wasm.MbsMarker('TestMarker');
            expect(marker.getName()).toBe('TestMarker');
            marker.delete();
        });

        it('should set and get position', () => {
            const marker = new wasm.MbsMarker('TestMarker');
            marker.setPosition({ x: 1, y: 2, z: 3 });
            const pos = marker.getPosition();
            expect(pos.x).toBeCloseTo(1);
            expect(pos.y).toBeCloseTo(2);
            expect(pos.z).toBeCloseTo(3);
            marker.delete();
        });
    });

    describe('MbsFrame', () => {
        it('should create a frame', () => {
            const frame = new wasm.MbsFrame('TestFrame');
            expect(frame.getName()).toBe('TestFrame');
            expect(frame.isPrimaryFrame()).toBe(false);
            frame.delete();
        });
    });

    describe('MbsParts', () => {
        it('should create a parts with default properties', () => {
            const parts = new wasm.MbsParts('TestParts');
            expect(parts.getName()).toBe('TestParts');
            expect(parts.getMass()).toBe(0);
            expect(parts.isGround()).toBe(false);
            parts.delete();
        });

        it('should set and get mass', () => {
            const parts = new wasm.MbsParts('TestParts');
            parts.setMass(10.5);
            expect(parts.getMass()).toBeCloseTo(10.5);
            parts.delete();
        });
    });

    describe('MbsRevolute', () => {
        it('should create a revolute joint', () => {
            const joint = new wasm.MbsRevolute('TestRevolute');
            expect(joint.getName()).toBe('TestRevolute');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Revolute);
            expect(joint.getDof()).toBe(1);
            joint.delete();
        });

        it('should set and get joint position', () => {
            const joint = new wasm.MbsRevolute('TestRevolute');
            joint.setJointPosition([Math.PI / 4]);
            const pos = joint.getJointPosition();
            expect(pos[0]).toBeCloseTo(Math.PI / 4);
            joint.delete();
        });
    });

    describe('MbsPrismatic', () => {
        it('should create a prismatic joint', () => {
            const joint = new wasm.MbsPrismatic('TestPrismatic');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Prismatic);
            expect(joint.getDof()).toBe(1);
            joint.delete();
        });
    });

    describe('MbsCylindrical', () => {
        it('should create a cylindrical joint', () => {
            const joint = new wasm.MbsCylindrical('TestCylindrical');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Cylindrical);
            expect(joint.getDof()).toBe(2);
            joint.delete();
        });
    });

    describe('MbsSpherical', () => {
        it('should create a spherical joint', () => {
            const joint = new wasm.MbsSpherical('TestSpherical');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Spherical);
            expect(joint.getDof()).toBe(3);
            joint.delete();
        });

        it('should set euler angles', () => {
            const joint = new wasm.MbsSpherical('TestSpherical');
            joint.setEulerAngles(0.1, 0.2, 0.3);
            const pos = joint.getJointPosition();
            expect(pos[0]).toBeCloseTo(0.1);
            expect(pos[1]).toBeCloseTo(0.2);
            expect(pos[2]).toBeCloseTo(0.3);
            joint.delete();
        });
    });

    describe('MbsUniversal', () => {
        it('should create a universal joint', () => {
            const joint = new wasm.MbsUniversal('TestUniversal');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Universal);
            expect(joint.getDof()).toBe(2);
            joint.delete();
        });
    });

    describe('MbsPlanar', () => {
        it('should create a planar joint', () => {
            const joint = new wasm.MbsPlanar('TestPlanar');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Planar);
            expect(joint.getDof()).toBe(3);
            joint.delete();
        });
    });

    describe('MbsFixed', () => {
        it('should create a fixed joint', () => {
            const joint = new wasm.MbsFixed('TestFixed');
            expect(joint.getJointType()).toBe(wasm.MbsJointType.Fixed);
            expect(joint.getDof()).toBe(0);
            joint.delete();
        });
    });

    describe('MbsRotationalMotion', () => {
        it('should create a rotational motion', () => {
            const motion = new wasm.MbsRotationalMotion('TestMotion');
            expect(motion.getName()).toBe('TestMotion');
            expect(motion.getMotionType()).toBe(wasm.MbsMotionType.Rotational);
            motion.delete();
        });

        it('should evaluate harmonic motion', () => {
            const motion = new wasm.MbsRotationalMotion('TestMotion');
            motion.setFunctionType(wasm.MbsMotionFunctionType.Harmonic);
            motion.setAmplitude(1.0);
            motion.setFrequency(1.0);
            motion.setPhase(0);

            // At t=0, sin(0) = 0
            expect(motion.evaluate(0)).toBeCloseTo(0);
            // At t=0.25, sin(π/2) = 1
            expect(motion.evaluate(0.25)).toBeCloseTo(1);
            motion.delete();
        });
    });

    describe('MbsTranslationalMotion', () => {
        it('should create a translational motion', () => {
            const motion = new wasm.MbsTranslationalMotion('TestMotion');
            expect(motion.getMotionType()).toBe(wasm.MbsMotionType.Translational);
            motion.delete();
        });

        it('should evaluate ramp motion', () => {
            const motion = new wasm.MbsTranslationalMotion('TestMotion');
            motion.setFunctionType(wasm.MbsMotionFunctionType.Ramp);
            motion.setSlope(2.0);
            motion.setOffset(1.0);

            // At t=0, value = 2*0 + 1 = 1
            expect(motion.evaluate(0)).toBeCloseTo(1);
            // At t=1, value = 2*1 + 1 = 3
            expect(motion.evaluate(1)).toBeCloseTo(3);
            motion.delete();
        });
    });

    describe('MbsGroup', () => {
        it('should create a group', () => {
            const group = new wasm.MbsGroup('TestGroup');
            expect(group.getName()).toBe('TestGroup');
            expect(group.isRoot()).toBe(true);
            group.delete();
        });

        it('should add and get parts', () => {
            const group = new wasm.MbsGroup('TestGroup');
            const parts = group.addParts('Part1');
            expect(parts.getName()).toBe('Part1');
            expect(group.getPartsCount()).toBe(1);

            const retrieved = group.getParts('Part1');
            expect(retrieved).not.toBeNull();
            expect(retrieved.getName()).toBe('Part1');
            group.delete();
        });
    });
});
