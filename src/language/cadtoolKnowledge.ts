export interface CadtoolBilingualDoc {
    zh: string;
    en: string;
}

export interface CadtoolKnowledgeEntry {
    value: string;
    detail: string;
    doc: CadtoolBilingualDoc;
}

export const CADTOOL_CONFIG_BASENAMES = [
    'cadtool.config.json',
    '.cadtoolrc.json'
] as const;

export const CADTOOL_NAME_RULE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const ICON_SIZE_MIN = 1;
export const ICON_SIZE_MAX = 50000;
export const POSITION_MIN = -1000;
export const POSITION_MAX = 1000;
export const DIRECTION_MIN = -180;
export const DIRECTION_MAX = 180;
export const CADTOOL_ROOT_OBJECT_ARRAY_FIELDS = [
    'objects',
    'group',
    'marker',
    'designPoint',
    'connector',
    'motion',
    'contact',
    'fluidPort',
    'ribSlice',
    'gravity',
    'medium'
] as const;

export const CADTOOL_OBJECT_TYPES: readonly CadtoolKnowledgeEntry[] = [
    {
        value: 'group',
        detail: 'Multi-body / grouping object',
        doc: {
            zh: '多体分组对象。',
            en: 'Grouping object for multi-body structures.'
        }
    },
    {
        value: 'marker',
        detail: 'Reference marker',
        doc: {
            zh: '标架对象，用于定义参考坐标。',
            en: 'Reference marker used to define local coordinates.'
        }
    },
    {
        value: 'designPoint',
        detail: 'Design point',
        doc: {
            zh: '设计点对象。',
            en: 'Design point object.'
        }
    },
    {
        value: 'connector',
        detail: 'Joint / connector object',
        doc: {
            zh: '连接对象，描述运动副。',
            en: 'Connector object that describes joints.'
        }
    },
    {
        value: 'motion',
        detail: 'Motion driver object',
        doc: {
            zh: '驱动对象。',
            en: 'Motion driver object.'
        }
    },
    {
        value: 'contact',
        detail: 'Contact object',
        doc: {
            zh: '接触对象。',
            en: 'Contact definition object.'
        }
    },
    {
        value: 'gravity',
        detail: 'Gravity object',
        doc: {
            zh: '重力设置对象。',
            en: 'Gravity settings object.'
        }
    },
    {
        value: 'material',
        detail: 'Material object',
        doc: {
            zh: '材料属性对象。',
            en: 'Material properties object.'
        }
    },
    {
        value: 'tankSlice',
        detail: 'Fluid tank slice object',
        doc: {
            zh: '油箱切片对象。',
            en: 'Fluid tank slice object.'
        }
    },
    {
        value: 'ribSlice',
        detail: 'Fluid rib slice object',
        doc: {
            zh: '肋板切片对象。',
            en: 'Fluid rib slice object.'
        }
    },
    {
        value: 'fluidPort',
        detail: 'Fluid port object',
        doc: {
            zh: '流体端口对象。',
            en: 'Fluid port object.'
        }
    },
    {
        value: 'medium',
        detail: 'Fluid medium object',
        doc: {
            zh: '流体介质对象。',
            en: 'Fluid medium object.'
        }
    }
];

export const CADTOOL_PARAMETER_FIELDS: readonly CadtoolKnowledgeEntry[] = [
    {
        value: 'objects',
        detail: 'Object list',
        doc: {
            zh: 'CADTool 对象数组。',
            en: 'Array of CADTool objects.'
        }
    },
    {
        value: 'group',
        detail: 'Group object list',
        doc: {
            zh: '分组对象数组。',
            en: 'Array of group objects.'
        }
    },
    {
        value: 'marker',
        detail: 'Marker object list',
        doc: {
            zh: '标架对象数组。',
            en: 'Array of marker objects.'
        }
    },
    {
        value: 'designPoint',
        detail: 'Design point list',
        doc: {
            zh: '设计点对象数组。',
            en: 'Array of design-point objects.'
        }
    },
    {
        value: 'connector',
        detail: 'Connector object list',
        doc: {
            zh: '连接对象数组。',
            en: 'Array of connector objects.'
        }
    },
    {
        value: 'motion',
        detail: 'Motion object list',
        doc: {
            zh: '驱动对象数组。',
            en: 'Array of motion objects.'
        }
    },
    {
        value: 'contact',
        detail: 'Contact object list',
        doc: {
            zh: '接触对象数组。',
            en: 'Array of contact objects.'
        }
    },
    {
        value: 'fluidPort',
        detail: 'Fluid port list',
        doc: {
            zh: '流体端口对象数组。',
            en: 'Array of fluid-port objects.'
        }
    },
    {
        value: 'ribSlice',
        detail: 'Rib-slice object list',
        doc: {
            zh: '肋板切片对象数组。',
            en: 'Array of rib-slice objects.'
        }
    },
    {
        value: 'gravity',
        detail: 'Gravity object list',
        doc: {
            zh: '重力对象数组。',
            en: 'Array of gravity objects.'
        }
    },
    {
        value: 'medium',
        detail: 'Medium object list',
        doc: {
            zh: '介质对象数组。',
            en: 'Array of medium objects.'
        }
    },
    {
        value: 'groupRef',
        detail: 'Group reference',
        doc: {
            zh: '分组对象引用名称。',
            en: 'Reference name of a group object.'
        }
    },
    {
        value: 'markerRef',
        detail: 'Marker reference',
        doc: {
            zh: '标架对象引用名称。',
            en: 'Reference name of a marker object.'
        }
    },
    {
        value: 'marker1',
        detail: 'First marker reference',
        doc: {
            zh: '第一个标架引用名称。',
            en: 'Reference name of the first marker.'
        }
    },
    {
        value: 'marker2',
        detail: 'Second marker reference',
        doc: {
            zh: '第二个标架引用名称。',
            en: 'Reference name of the second marker.'
        }
    },
    {
        value: 'connectorRef',
        detail: 'Connector reference',
        doc: {
            zh: '连接对象引用名称。',
            en: 'Reference name of a connector object.'
        }
    },
    {
        value: 'ribSliceRef',
        detail: 'Rib-slice reference',
        doc: {
            zh: '肋板切片对象引用名称。',
            en: 'Reference name of a rib-slice object.'
        }
    },
    {
        value: 'part1',
        detail: 'First part reference',
        doc: {
            zh: '第一个零件引用名称。',
            en: 'Reference name of the first part.'
        }
    },
    {
        value: 'part2',
        detail: 'Second part reference',
        doc: {
            zh: '第二个零件引用名称。',
            en: 'Reference name of the second part.'
        }
    },
    {
        value: 'partA',
        detail: 'Part A reference',
        doc: {
            zh: 'A 侧零件引用名称。',
            en: 'Reference name of part A.'
        }
    },
    {
        value: 'partB',
        detail: 'Part B reference',
        doc: {
            zh: 'B 侧零件引用名称。',
            en: 'Reference name of part B.'
        }
    },
    {
        value: 'partRef',
        detail: 'Part reference',
        doc: {
            zh: '零件对象引用名称。',
            en: 'Reference name of a part object.'
        }
    },
    {
        value: 'tankRef',
        detail: 'Tank reference',
        doc: {
            zh: '油箱对象引用名称。',
            en: 'Reference name of a tank object.'
        }
    },
    {
        value: 'parts',
        detail: 'Part reference list',
        doc: {
            zh: '零件引用数组。',
            en: 'Array of part references.'
        }
    },
    {
        value: 'markers',
        detail: 'Marker reference list',
        doc: {
            zh: '标架引用数组。',
            en: 'Array of marker references.'
        }
    },
    {
        value: 'designPoints',
        detail: 'Design-point reference list',
        doc: {
            zh: '设计点引用数组。',
            en: 'Array of design-point references.'
        }
    },
    {
        value: 'type',
        detail: 'Object type',
        doc: {
            zh: '对象类型。',
            en: 'Object type.'
        }
    },
    {
        value: 'name',
        detail: 'Unique object name',
        doc: {
            zh: '对象唯一名称，需符合命名规则。',
            en: 'Unique object name that must follow naming rules.'
        }
    },
    {
        value: 'iconSize',
        detail: 'Icon size (1~50000)',
        doc: {
            zh: '图标大小，范围 1~50000。',
            en: 'Icon size, range 1~50000.'
        }
    },
    {
        value: 'visibility',
        detail: 'Visibility mode',
        doc: {
            zh: '可见性配置。',
            en: 'Visibility mode.'
        }
    },
    {
        value: 'position',
        detail: 'Position array (-1000~1000)',
        doc: {
            zh: '位置数组，每项范围 -1000~1000。',
            en: 'Position array, each value must be between -1000 and 1000.'
        }
    },
    {
        value: 'direction',
        detail: 'Direction array (-180~180)',
        doc: {
            zh: '方向数组，每项范围 -180~180。',
            en: 'Direction array, each value must be between -180 and 180.'
        }
    },
    {
        value: 'errorCode',
        detail: 'Known error code',
        doc: {
            zh: '错误码字段，可补全已知错误码。',
            en: 'Error code field with known code completions.'
        }
    },
    {
        value: 'connectorType',
        detail: 'Connector type enum',
        doc: {
            zh: '连接类型枚举。',
            en: 'Connector type enum.'
        }
    },
    {
        value: 'motionType',
        detail: 'Motion type enum',
        doc: {
            zh: '驱动类型枚举。',
            en: 'Motion type enum.'
        }
    },
    {
        value: 'portType',
        detail: 'Fluid port type enum',
        doc: {
            zh: '流体端口类型枚举。',
            en: 'Fluid port type enum.'
        }
    },
    {
        value: 'gravityType',
        detail: 'Multi-body gravity type enum',
        doc: {
            zh: '多体重力类型枚举。',
            en: 'Multi-body gravity type enum.'
        }
    },
    {
        value: 'gType',
        detail: 'Fluid gravity type enum',
        doc: {
            zh: '流体重力类型枚举。',
            en: 'Fluid gravity type enum.'
        }
    }
];

export const CADTOOL_ENUM_VALUES_BY_FIELD: Readonly<Record<string, readonly CadtoolKnowledgeEntry[]>> = {
    connectorType: [
        {
            value: 'fixed',
            detail: 'Fixed joint',
            doc: {
                zh: '固定副',
                en: 'Fixed joint.'
            }
        },
        {
            value: 'spherical',
            detail: 'Spherical joint',
            doc: {
                zh: '球副',
                en: 'Spherical joint.'
            }
        },
        {
            value: 'planar',
            detail: 'Planar joint',
            doc: {
                zh: '平面副',
                en: 'Planar joint.'
            }
        },
        {
            value: 'revolute',
            detail: 'Revolute joint',
            doc: {
                zh: '转动副',
                en: 'Revolute joint.'
            }
        },
        {
            value: 'prismatic',
            detail: 'Prismatic joint',
            doc: {
                zh: '移动副',
                en: 'Prismatic joint.'
            }
        },
        {
            value: 'cylindrical',
            detail: 'Cylindrical joint',
            doc: {
                zh: '圆柱副',
                en: 'Cylindrical joint.'
            }
        },
        {
            value: 'universal',
            detail: 'Universal joint',
            doc: {
                zh: '万向节',
                en: 'Universal joint.'
            }
        },
        {
            value: 'constantVelocity',
            detail: 'Constant-velocity joint',
            doc: {
                zh: 'Constant-velocity joint.',
                en: 'Constant-velocity joint.'
            }
        },
        {
            value: 'screw',
            detail: 'Screw joint',
            doc: {
                zh: '螺旋副',
                en: 'Screw joint.'
            }
        }
    ],
    motionType: [
        {
            value: 'rotational',
            detail: 'Rotational joint motion',
            doc: {
                zh: 'Rotational joint motion.',
                en: 'Rotational joint motion.'
            }
        },
        {
            value: 'translational',
            detail: 'Translational joint motion',
            doc: {
                zh: 'Translational joint motion.',
                en: 'Translational joint motion.'
            }
        },
        {
            value: 'displacement',
            detail: 'Displacement drive',
            doc: {
                zh: 'Displacement drive.',
                en: 'Displacement drive.'
            }
        },
        {
            value: 'angle',
            detail: 'Angle drive',
            doc: {
                zh: '角度驱动',
                en: 'Angle drive.'
            }
        },
        {
            value: 'angularVelocity',
            detail: 'Angular velocity drive',
            doc: {
                zh: '角速度驱动',
                en: 'Angular velocity drive.'
            }
        },
        {
            value: 'angularAcceleration',
            detail: 'Angular acceleration drive',
            doc: {
                zh: '角加速度驱动',
                en: 'Angular acceleration drive.'
            }
        },
        {
            value: 'position',
            detail: 'Position drive',
            doc: {
                zh: '位移驱动',
                en: 'Position drive.'
            }
        },
        {
            value: 'velocity',
            detail: 'Velocity drive',
            doc: {
                zh: '速度驱动',
                en: 'Velocity drive.'
            }
        },
        {
            value: 'acceleration',
            detail: 'Acceleration drive',
            doc: {
                zh: '加速度驱动',
                en: 'Acceleration drive.'
            }
        }
    ],
    portType: [
        {
            value: 'variableTankGasPort',
            detail: 'Variable gas orifice',
            doc: {
                zh: '可变油箱气体孔口',
                en: 'Variable gas orifice of tank.'
            }
        },
        {
            value: 'variableTankLiquidPort',
            detail: 'Variable liquid orifice',
            doc: {
                zh: '可变油箱液体孔口',
                en: 'Variable liquid orifice of tank.'
            }
        },
        {
            value: 'variableTankFillingPort',
            detail: 'Variable fill orifice',
            doc: {
                zh: '可变油箱填充孔口',
                en: 'Variable fill orifice of tank.'
            }
        },
        {
            value: 'variableTankGasLiquidPort',
            detail: 'Variable gas-liquid orifice',
            doc: {
                zh: 'Variable gas-liquid orifice of tank.',
                en: 'Variable gas-liquid orifice of tank.'
            }
        }
    ],
    gravityType: [
        {
            value: 'uniform',
            detail: 'Uniform gravity field (multi-body)',
            doc: {
                zh: '均匀重力场',
                en: 'Uniform gravity field.'
            }
        },
        {
            value: 'none',
            detail: 'No gravity field',
            doc: {
                zh: '无重力场',
                en: 'No gravity field.'
            }
        },
        {
            value: 'point',
            detail: 'Point gravity field',
            doc: {
                zh: '点重力场',
                en: 'Point gravity field.'
            }
        },
        {
            value: 'constant',
            detail: 'Constant gravity (fluid)',
            doc: {
                zh: '常数重力（流体）',
                en: 'Constant gravity mode for fluid.'
            }
        },
        {
            value: 'table',
            detail: 'Table gravity (fluid)',
            doc: {
                zh: '表格重力（流体）',
                en: 'Table gravity mode for fluid.'
            }
        }
    ],
    gType: [
        {
            value: 'constant',
            detail: 'Constant gravity',
            doc: {
                zh: '常数重力',
                en: 'Constant gravity.'
            }
        },
        {
            value: 'table',
            detail: 'Table gravity',
            doc: {
                zh: '表格数据重力',
                en: 'Table-based gravity.'
            }
        }
    ],
    stateSelect: [
        {
            value: 'none',
            detail: 'StateSelect.none',
            doc: {
                zh: 'No explicit state selection.',
                en: 'No explicit state selection.'
            }
        },
        {
            value: 'never',
            detail: 'StateSelect.never',
            doc: {
                zh: '从不选作状态变量',
                en: 'Never use as state.'
            }
        },
        {
            value: 'avoid',
            detail: 'StateSelect.avoid',
            doc: {
                zh: '尽量避免选作状态变量',
                en: 'Avoid using as state.'
            }
        },
        {
            value: 'default',
            detail: 'StateSelect.default',
            doc: {
                zh: '默认状态选择',
                en: 'Default state selection.'
            }
        },
        {
            value: 'prefer',
            detail: 'StateSelect.prefer',
            doc: {
                zh: '优先选作状态变量',
                en: 'Prefer as state.'
            }
        },
        {
            value: 'always',
            detail: 'StateSelect.always',
            doc: {
                zh: '总是选作状态变量',
                en: 'Always as state.'
            }
        }
    ],
    visibility: [
        {
            value: 'visible',
            detail: 'Visible',
            doc: {
                zh: '可见。',
                en: 'Visible.'
            }
        },
        {
            value: 'hidden',
            detail: 'Hidden',
            doc: {
                zh: '隐藏。',
                en: 'Hidden.'
            }
        }
    ],
    outputMode: [
        {
            value: 'full',
            detail: 'Full output',
            doc: {
                zh: '完整导出模式。',
                en: 'Full export mode.'
            }
        },
        {
            value: 'preview',
            detail: 'Preview output',
            doc: {
                zh: '预览导出模式。',
                en: 'Preview export mode.'
            }
        }
    ]
};

export const CADTOOL_ERROR_CODES: readonly CadtoolKnowledgeEntry[] = [
    {
        value: 'ERR_CAD_SOFTWARE_NOT_INSTALLED',
        detail: 'CAD software is not installed',
        doc: {
            zh: '未检测到 CAD 软件安装。',
            en: 'CAD software is not installed.'
        }
    },
    {
        value: 'ERR_CAD_VERSION_TOO_LOW',
        detail: 'CAD software version is too low',
        doc: {
            zh: 'CAD 软件版本过低。',
            en: 'CAD software version is too low.'
        }
    },
    {
        value: 'ERR_OPEN_CAD_SOFTWARE_FAILED',
        detail: 'Failed to launch CAD software',
        doc: {
            zh: '打开 CAD 软件失败。',
            en: 'Failed to launch CAD software.'
        }
    },
    {
        value: 'ERR_OPEN_CAD_FILE_FAILED',
        detail: 'Failed to open CAD file',
        doc: {
            zh: '打开 CAD 文件失败。',
            en: 'Failed to open CAD file.'
        }
    },
    {
        value: 'CAD_FILE_IS_EMPTY',
        detail: 'Opened CAD file is empty',
        doc: {
            zh: '打开的 CAD 文件为空。',
            en: 'Opened CAD file is empty.'
        }
    },
    {
        value: 'ERR_PARSE_FILE_FAILED',
        detail: 'Failed to parse CAD file',
        doc: {
            zh: '解析 CAD 文件失败。',
            en: 'Failed to parse CAD file.'
        }
    },
    {
        value: 'ERR_EXPORT_STEP_FAILED',
        detail: 'Failed to export STEP file',
        doc: {
            zh: '导出 STEP 文件失败。',
            en: 'Failed to export STEP file.'
        }
    },
    {
        value: 'ERR_GENERATE_FILE_FAILED',
        detail: 'Failed to generate TY3D file',
        doc: {
            zh: '生成 TY3D 文件失败。',
            en: 'Failed to generate TY3D file.'
        }
    },
    {
        value: 'ERR_RUNTIME',
        detail: 'Unknown runtime error',
        doc: {
            zh: '未知运行时错误。',
            en: 'Unknown runtime error.'
        }
    },
    {
        value: 'PARSER_PATH_INVALID',
        detail: 'Cannot find CAD parser',
        doc: {
            zh: '找不到 CAD 解析器。',
            en: 'Cannot find CAD parser.'
        }
    },
    {
        value: 'ERR_CREATE_PROCESS_FAILED',
        detail: 'Failed to start CAD parser',
        doc: {
            zh: 'CAD 解析器启动失败。',
            en: 'Failed to start CAD parser.'
        }
    },
    {
        value: 'ERR_DATA_EXCHANGE_FAILED',
        detail: 'CAD parser internal error',
        doc: {
            zh: 'CAD 解析器内部错误。',
            en: 'CAD parser internal error.'
        }
    }
];

export const CADTOOL_FIELD_HOVER_DOCS: Readonly<Record<string, CadtoolBilingualDoc>> = {
    objects: {
        zh: 'CADTool 对象列表。',
        en: 'Array of CADTool objects.'
    },
    type: {
        zh: '对象类型。',
        en: 'Object type.'
    },
    name: {
        zh: '对象名称：以字母/下划线开头，仅字母数字下划线。',
        en: 'Object name: start with letter/_ and use only letters, digits, _.'
    },
    iconSize: {
        zh: '图标大小范围：1~50000。',
        en: 'Icon size range: 1~50000.'
    },
    position: {
        zh: '位置数组，每个值范围 -1000~1000。',
        en: 'Position array, each value range is -1000~1000.'
    },
    direction: {
        zh: '方向数组，每个值范围 -180~180。',
        en: 'Direction array, each value range is -180~180.'
    },
    visibility: {
        zh: '对象可见性。',
        en: 'Object visibility.'
    },
    errorCode: {
        zh: '错误码，用于定位导入或生成异常。',
        en: 'Error code for import/generation issues.'
    },
    connectorType: {
        zh: '连接类型枚举。',
        en: 'Connector type enum.'
    },
    motionType: {
        zh: '驱动类型枚举。',
        en: 'Motion type enum.'
    },
    portType: {
        zh: '流体端口类型枚举。',
        en: 'Fluid port type enum.'
    },
    gravityType: {
        zh: '多体重力类型枚举。',
        en: 'Multi-body gravity type enum.'
    },
    gType: {
        zh: '流体重力类型枚举。',
        en: 'Fluid gravity type enum.'
    },
    stateSelect: {
        zh: '状态变量选择策略枚举。',
        en: 'State variable selection strategy enum.'
    },
    group: {
        zh: '分组对象数组。',
        en: 'Array of group objects.'
    },
    marker: {
        zh: '标架对象数组。',
        en: 'Array of marker objects.'
    },
    designPoint: {
        zh: '设计点对象数组。',
        en: 'Array of design-point objects.'
    },
    connector: {
        zh: '连接对象数组。',
        en: 'Array of connector objects.'
    },
    motion: {
        zh: '驱动对象数组。',
        en: 'Array of motion objects.'
    },
    contact: {
        zh: '接触对象数组。',
        en: 'Array of contact objects.'
    },
    fluidPort: {
        zh: '流体端口对象数组。',
        en: 'Array of fluid-port objects.'
    },
    ribSlice: {
        zh: '肋板切片对象数组。',
        en: 'Array of rib-slice objects.'
    },
    gravity: {
        zh: '重力对象数组。',
        en: 'Array of gravity objects.'
    },
    medium: {
        zh: '介质对象数组。',
        en: 'Array of medium objects.'
    },
    groupRef: {
        zh: '分组对象引用名称。',
        en: 'Reference name of a group object.'
    },
    markerRef: {
        zh: '标架对象引用名称。',
        en: 'Reference name of a marker object.'
    },
    marker1: {
        zh: '第一个标架引用名称。',
        en: 'Reference name of the first marker.'
    },
    marker2: {
        zh: '第二个标架引用名称。',
        en: 'Reference name of the second marker.'
    },
    connectorRef: {
        zh: '连接对象引用名称。',
        en: 'Reference name of a connector object.'
    },
    ribSliceRef: {
        zh: '肋板切片对象引用名称。',
        en: 'Reference name of a rib-slice object.'
    },
    part1: {
        zh: '第一个零件引用名称。',
        en: 'Reference name of the first part.'
    },
    part2: {
        zh: '第二个零件引用名称。',
        en: 'Reference name of the second part.'
    },
    partA: {
        zh: 'A 侧零件引用名称。',
        en: 'Reference name of part A.'
    },
    partB: {
        zh: 'B 侧零件引用名称。',
        en: 'Reference name of part B.'
    },
    partRef: {
        zh: '零件对象引用名称。',
        en: 'Reference name of a part object.'
    },
    tankRef: {
        zh: '油箱对象引用名称。',
        en: 'Reference name of a tank object.'
    },
    parts: {
        zh: '零件引用数组。',
        en: 'Array of part references.'
    },
    markers: {
        zh: '标架引用数组。',
        en: 'Array of marker references.'
    },
    designPoints: {
        zh: '设计点引用数组。',
        en: 'Array of design-point references.'
    }
};
