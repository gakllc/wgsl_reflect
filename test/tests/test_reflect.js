import { test, group } from "../test.js";
import { WgslReflect } from "../../../wgsl_reflect.module.js";

group("Reflect", function () {
  test("alias struct", function (test) {
    const shader = `alias foo = u32;
    alias bar = foo;
    struct Vehicle {
      num_wheels: bar,
      mass_kg: f32,
    }
    alias Car = Vehicle;
    const num_cars = 2 * 2;
    struct Ship {
        cars: array<Car, num_cars>,
    };
    const a_bicycle = Car(2, 10.5);
    const bike_num_wheels = a_bicycle.num_wheels;
    struct Ocean {
        things: array<Ship, a_bicycle.num_wheels>,
    };
    @group(0) @binding(0) var<uniform> ocean: Ocean;`;

    const reflect = new WgslReflect(shader);
    test.equals(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    test.equals(bufferInfo.size, 64);
  });

  test("const", function (test) {
    const shader = `const NUM_COLORS = 10 + 2;
    @group(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
    const reflect = new WgslReflect(shader);
    test.equals(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    test.equals(bufferInfo.size, 16 * 12);
  });

  test("const2", function (test) {
    const shader = `const FOO = radians(90);
    const BAR = sin(FOO);
    const NUM_COLORS = u32(BAR + 3); // result 4
    @group(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
    const reflect = new WgslReflect(shader);
    test.equals(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    test.equals(bufferInfo.size, 16 * 4);
  });

  test("alias", function (test) {
    const shader = `alias material_index = u32;
        alias color = vec3f;
        struct material {
            index: material_index,
            diffuse: color,
        }
        @group(0) @binding(1) var<storage> materials: array<material, 10>;`;

    const reflect = new WgslReflect(shader);
    test.equals(reflect.aliases.length, 2);
    const info = reflect.getStorageBufferInfo(reflect.storage[0]);
    test.equals(!!info, true);
  });

  test("nested-alias", function (test) {
    const shader = `
          struct Foo {
            a: u32,
            b: f32,
          };
          alias foo1 = Foo;
          alias foo2 = foo1;
          alias foo3 = foo2;
          @group(0) @binding(1) var<storage> materials: foo3;
    `;
    const reflect = new WgslReflect(shader);
    test.equals(reflect.aliases.length, 3);
    const info = reflect.getStorageBufferInfo(reflect.storage[0]);
    test.equals(info.isStruct, true);
    test.equals(info.isArray, false);
    test.equals(info.members.length, 2);
    test.equals(info.size, 8);
  });

  test("nested-alias-array", function (test) {
    const shader = `
        struct Foo {
          a: u32,
          b: f32,
        };
        alias foo1 = Foo;
        alias foo2 = foo1;
        alias foo3 = foo2;
        @group(0) @binding(1) var<storage> materials: array<foo3, 10>;
    `;
    const reflect = new WgslReflect(shader);
    test.equals(reflect.aliases.length, 3);
    const info = reflect.getStorageBufferInfo(reflect.storage[0]);
    test.equals(info.isStruct, true);
    test.equals(info.isArray, true);
    test.equals(info.members.length, 2);
    test.equals(info.size, 80);
  });

  test("typedef", function (test) {
    const shader = `alias Arr_1 = array<vec4<f32>, 20u>;

        struct VGlobals {
          x_Time : vec4<f32>,
          x_WorldSpaceCameraPos : vec3<f32>,
          @size(4)
          padding : u32,
          x_ProjectionParams : vec4<f32>,
          unity_FogParams : vec4<f32>,
          unity_MatrixV : mat4x4<f32>,
          unity_MatrixVP : mat4x4<f32>,
          x_MaxDepth : f32,
          x_MaxWaveHeight : f32,
          @size(8)
          padding_1 : u32,
          x_VeraslWater_DepthCamParams : vec4<f32>,
          x_WaveCount : u32,
          @size(12)
          padding_2 : u32,
          waveData : Arr_1,
        }
        @group(0) @binding(24) var<uniform> x_75 : VGlobals;`;
    const reflect = new WgslReflect(shader);

    test.equals(reflect.uniforms.length, 1);
    test.equals(reflect.uniforms[0].name, "x_75");
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    test.equals(bufferInfo.size, 560);
  });

  const shader = `
struct ViewUniforms {
    viewProjection: mat4x4<f32>
};

struct ModelUniforms {
    model: mat4x4<f32>,
    color: vec4<f32>,
    intensity: f32
};

@binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @group(0) var u_sampler: sampler;
@binding(3) @group(0) var u_texture: texture_2d<f32>;

struct VertexInput {
    @builtin(position) a_position: vec3<f32>,
    @location(1) a_normal: vec3<f32>,
    @location(2) a_color: vec4<f32>,
    @location(3) a_uv: vec2<f32>
};

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) v_position: vec4<f32>,
    @location(1) v_normal: vec3<f32>,
    @location(2) v_color: vec4<f32>,
    @location(3) v_uv: vec2<f32>,
};

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.Position = viewUniforms.viewProjection * modelUniforms.model * vec4<f32>(input.a_position, 1.0);
    output.v_position = output.Position;
    output.v_normal = input.a_normal;
    output.v_color = input.a_color * modelUniforms.color * modelUniforms.intensity;
    output.v_uv = input.a_uv;
    return output;
}

@fragment
fn frag_main() {}

@compute @workgroup_size(8,4,1)
fn sorter() { }

@compute @workgroup_size(8u)
fn reverser() { }

// Using an pipeline-overridable constant.
@id(42) override block_width = 12u;
@compute @workgroup_size(block_width)
fn shuffler() { }
`;

  const reflect = new WgslReflect(shader);

  test("struct", function (test) {
    test.equals(reflect.structs.length, 4);

    const names = reflect.structs.map((s) => s.name);
    test.true(names.includes("ViewUniforms"));
    test.true(names.includes("ModelUniforms"));
    test.true(names.includes("VertexInput"));
    test.true(names.includes("VertexOutput"));

    test.notNull(reflect.getStructInfo(reflect.structs[0]));
    test.notNull(reflect.getStructInfo(reflect.structs[1]));
    test.notNull(reflect.getStructInfo(reflect.structs[2]));
    test.notNull(reflect.getStructInfo(reflect.structs[3]));
  });

  test("uniforms", function (test) {
    test.equals(reflect.uniforms.length, 2);
    test.equals(reflect.uniforms[0].name, "viewUniforms");
    test.equals(reflect.uniforms[0].type.name, "ViewUniforms");
    test.notNull(reflect.getStruct(reflect.uniforms[0].type));
  });

  test("textures", function (test) {
    test.equals(reflect.textures.length, 1);
    test.equals(reflect.textures[0].name, "u_texture");
    test.equals(reflect.textures[0].type.name, "texture_2d");
    test.equals(reflect.textures[0].type.format.name, "f32");
    test.equals(reflect.textures[0].group, 0);
    test.equals(reflect.textures[0].binding, 3);
  });

  test("samplers", function (test) {
    test.equals(reflect.samplers.length, 1);
    test.equals(reflect.samplers[0].name, "u_sampler");
    test.equals(reflect.samplers[0].type.name, "sampler");
    test.equals(reflect.samplers[0].group, 0);
    test.equals(reflect.samplers[0].binding, 2);
  });

  test("uniformBufferInfo", function (test) {
    const buffer = reflect.getUniformBufferInfo(reflect.uniforms[1]);
    test.notNull(buffer);
    test.equals(buffer.type.name, "ModelUniforms", "buffer.type");
    test.equals(buffer.size, 96, "buffer.size");
    test.equals(buffer.group, "0", "buffer.group.value");
    test.equals(buffer.binding, "1", "buffer.binding.value");
    test.equals(buffer.members.length, 3, "buffer.members.length");
    test.equals(buffer.members[0].name, "model", "buffer.members[0].name");
    test.equals(buffer.members[1].name, "color", "buffer.members[1].name");
    test.equals(buffer.members[2].name, "intensity", "buffer.members[1].name");
  });

  test("getBindingGroups", function (test) {
    const groups = reflect.getBindGroups();
    test.equals(groups.length, 1);
    test.equals(groups[0].length, 4);
    test.equals(groups[0][0].type, "buffer");
    test.equals(groups[0][1].type, "buffer");
    test.equals(groups[0][2].type, "sampler");
    test.equals(groups[0][3].type, "texture");
    test.equals(groups[0][3].resource.type.name, "texture_2d");
    test.equals(groups[0][3].resource.type.format.name, "f32");
  });

  test("function", function (test) {
    test.equals(reflect.functions.length, 5);
    test.equals(reflect.functions[0].name, "vertex_main");
    test.equals(reflect.functions[1].name, "frag_main");
    test.equals(reflect.functions[2].name, "sorter");
    test.equals(reflect.functions[3].name, "reverser");
    test.equals(reflect.functions[4].name, "shuffler");
  });

  test("entry", function (test) {
    test.equals(reflect.entry.vertex.length, 1);
    test.equals(reflect.entry.fragment.length, 1);
    test.equals(reflect.entry.compute.length, 3);
  });

  test("vertexInputs", function (test) {
    const inputs = reflect.entry.vertex[0].inputs;
    test.equals(inputs.length, 4);
    test.validateObject(inputs[0], {
      name: "a_position",
      locationType: "builtin",
      location: "position",
      type: { name: "vec3" },
    });

    test.validateObject(inputs[1], {
      name: "a_normal",
      locationType: "location",
      location: 1,
      type: { name: "vec3" },
    });
  });

  test("storageBuffers", function (test) {
    const shader = `@group(0) @binding(0) var<storage, read> x : array<f32>;
        @group(0) @binding(1) var<storage, read> y : array<f32>;
        @group(0) @binding(2) var<storage, write> z : array<f32>;
        
        @stage(compute) @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
          // Guard against out-of-bounds work group sizes
          var idx = global_id.x;
          z[idx] = x[idx] + y[idx];
        }`;
    const reflect = new WgslReflect(shader);

    const groups = reflect.getBindGroups();

    test.equals(reflect.storage.length, 3);
    test.equals(groups.length, 1);
    test.equals(groups[0].length, 3);
    test.equals(groups[0][0].type, "storage");
    test.equals(groups[0][0].resource.name, "x");
    test.equals(groups[0][0].resource.type.name, "array");
    test.equals(groups[0][0].resource.type.format.name, "f32");
    test.equals(groups[0][1].type, "storage");
    test.equals(groups[0][1].resource.name, "y");
    test.equals(groups[0][1].resource.type.name, "array");
    test.equals(groups[0][1].resource.type.format.name, "f32");
    test.equals(groups[0][2].type, "storage");
    test.equals(groups[0][2].resource.name, "z");
    test.equals(groups[0][2].resource.type.name, "array");
    test.equals(groups[0][2].resource.type.format.name, "f32");
  });

  test("nested structs", function (test) {
    const shader = `struct ViewUniforms {
            viewProjection: mat4x4<f32>
        };
        
        struct ModelUniforms {
            model: mat4x4<f32>,
            color: vec4<f32>,
            intensity: f32,
            view: array<ViewUniforms,2>,
            f32Array: array<f32,2>
        };
        @group(0) @binding(0) var<uniform> model : ModelUniforms;
        @binding(1) @group(0) var<uniform> uArray: array<vec4<f32>, 7>;
        @binding(2) @group(0) var<uniform> uFloat: f32;`;
    const reflect = new WgslReflect(shader);

    test.equals(reflect.uniforms.length, 3);

    const info = reflect.getStructInfo(reflect.structs[1]);
    test.equals(info.members.length, 5);
    test.equals(info.members[0].name, "model");
    test.equals(info.members[0].isStruct, false);
    test.equals(info.members[0].offset, 0);
    test.equals(info.members[0].size, 64);
    test.equals(info.members[0].arrayStride, 64);
    test.equals(info.members[1].name, "color");
    test.equals(info.members[1].offset, 64);
    test.equals(info.members[1].size, 16);
    test.equals(info.members[2].name, "intensity");
    test.equals(info.members[2].offset, 80);
    test.equals(info.members[2].size, 4);
    test.equals(info.members[3].name, "view");
    test.equals(info.members[3].type.name, "array");
    test.equals(info.members[3].type.format.name, "ViewUniforms");
    test.equals(info.members[3].isStruct, true);
    test.equals(info.members[3].isArray, true);
    test.equals(info.members[3].arrayCount, 2);
    test.equals(info.members[3].offset, 96);
    test.equals(info.members[3].size, 128);
    test.equals(info.members[3].arrayStride, 64);
    test.equals(info.members[3].members.length, 1);
    test.equals(info.members[3].members[0].name, "viewProjection");
    test.equals(info.members[3].members[0].offset, 0);
    test.equals(info.members[3].members[0].size, 64);
    test.equals(info.members[4].name, "f32Array");
    test.equals(info.members[4].arrayCount, 2);
    test.equals(info.members[4].offset, 224);
    test.equals(info.members[4].size, 8);
    test.equals(info.members[4].arrayStride, 4);

    const u0 = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    test.equals(u0.name, "model");
    test.equals(u0.type.name, "ModelUniforms");
    test.equals(u0.members.length, 5);
    test.equals(u0.size, 240);

    const u1 = reflect.getUniformBufferInfo(reflect.uniforms[1]);
    test.equals(u1.name, "uArray");
    test.equals(u1.type.name, "array");
    test.equals(u1.type.format.name, "vec4");
    test.equals(u1.type.format.format.name, "f32");
    test.equals(u1.size, 112);
    test.equals(u1.align, 16);
    test.equals(u1.isArray, true);
    test.equals(u1.arrayStride, 16);
    test.equals(u1.arrayCount, 7);

    const u2 = reflect.getUniformBufferInfo(reflect.uniforms[2]);
    test.equals(u2.name, "uFloat");
    test.equals(u2.type.name, "f32");
    test.equals(u2.size, 4);
    test.equals(u2.align, 4);
  });

  test("nested structs", function (test) {
    const shader = `
        struct SomeStruct {
            value: f32,
        };

        struct SomeOtherStruct {
            member1: f32,
            member2: array<f32, 4>,
            member3: SomeStruct,
            member4: array<SomeStruct, 4>,
        };

        @group(0) @binding(0) var<uniform> uni1 : f32;
        @group(0) @binding(1) var<uniform> uni2 : array<f32, 4>;
        @group(0) @binding(2) var<uniform> uni3 : SomeStruct;
        @group(0) @binding(2) var<uniform> uni4 : array<SomeStruct, 4>;

        @group(1) @binding(0) var<storage> storage1 : f32;
        @group(1) @binding(1) var<storage> storage2 : array<f32, 4>;
        @group(1) @binding(2) var<storage> storage3 : SomeStruct;
        @group(1) @binding(2) var<storage> storage4 : array<SomeStruct, 4>;
        `;
    const reflect = new WgslReflect(shader);
    const uniforms = Object.fromEntries(
      reflect.uniforms.map((u) => [u.name, u])
    );
    const structs = Object.fromEntries(reflect.structs.map((s) => [s.name, s]));
    const storages = Object.fromEntries(
      reflect.storage.map((s) => [s.name, s])
    );

    const someOtherStruct = reflect.getStructInfo(structs.SomeOtherStruct);
    const members = Object.fromEntries(
      someOtherStruct.members.map((m) => [m.name, m])
    );

    const compare = (uniName, memberName, storageName) => {
      const uni = uniforms[uniName];
      const member = members[memberName];
      const storage = storages[storageName];

      const uniInfo = reflect.getUniformBufferInfo(uni);
      const storageInfo = reflect.getStorageBufferInfo(storage);
      //console.log(uniInfo, member);
      test.equals(
        uniInfo.size,
        member.size,
        `size: ${uniName} vs ${memberName}`
      );
      test.equals(
        storageInfo.size,
        member.size,
        `size: ${storageName} vs ${memberName}`
      );

      test.equals(
        !!uniInfo.isArray,
        !!member.isArray,
        `isArray: ${uniName} vs ${memberName}`
      );
      test.equals(
        !!storageInfo.isArray,
        !!member.isArray,
        `isArray: ${storageName} vs ${memberName}`
      );
      if (!uniInfo.isArray) {
        test.equals(
          uniInfo.arrayCount,
          member.arrayCount,
          `arrayCount: ${uniName} vs ${memberName}`
        );
        test.equals(
          uniInfo.arrayStride,
          member.arrayStride,
          `arrayStride: ${uniName} vs ${memberName}`
        );
        test.equals(
          storageInfo.arrayCount,
          member.arrayCount,
          `arrayCount: ${storageName} vs ${memberName}`
        );
        test.equals(
          storageInfo.arrayStride,
          member.arrayStride,
          `arrayStride: ${storageName} vs ${memberName}`
        );
      }

      test.equals(
        !!uniInfo.isStruct,
        !!member.isStruct,
        `isStruct: ${uniName} vs ${memberName}`
      );
      test.equals(
        !!storageInfo.isStruct,
        !!member.isStruct,
        `isStruct: ${storageName} vs ${memberName}`
      );
      if (uniInfo.isStruct) {
        test.equals(
          uniInfo.members.length,
          member.members.length,
          `members.length: ${uniName} vs ${memberName}`
        );
        test.equals(
          storageInfo.members.length,
          member.members.length,
          `members.length: ${storageName} vs ${memberName}`
        );
        // should we test deeper?
      }
    };

    compare("uni1", "member1", "storage1");
    compare("uni2", "member2", "storage2");
    compare("uni3", "member3", "storage3");
    compare("uni4", "member4", "storage4");
  });

  function roundUp(k, n) {
    return Math.ceil(n / k) * k;
  }

  function testType(test, type) {
    const shader = `
        struct Types {
            m_base: ${type},
            m_vec2: vec2<${type}>,
            m_vec3: vec3<${type}>,
            m_vec4: vec4<${type}>,
            m_mat2x2: mat2x2<${type}>,
            m_mat3x2: mat3x2<${type}>,
            m_mat4x2: mat4x2<${type}>,
            m_mat2x3: mat2x3<${type}>,
            m_mat3x3: mat3x3<${type}>,
            m_mat4x3: mat4x3<${type}>,
            m_mat2x4: mat2x4<${type}>,
            m_mat3x4: mat3x4<${type}>,
            m_mat4x4: mat4x4<${type}>,
        };
        @group(0) @binding(0) var<uniform> u: Types;
        `;
    console.log(shader);
    const reflect = new WgslReflect(shader);

    const info = reflect.getStructInfo(reflect.structs[0]);

    const fields = [
      { name: "m_base", align: 4, size: 4 },
      { name: "m_vec2", align: 8, size: 8 },
      { name: "m_vec3", align: 16, size: 12 },
      { name: "m_vec4", align: 16, size: 16 },
      { name: "m_mat2x2", align: 8, size: 16 },
      { name: "m_mat3x2", align: 8, size: 24 },
      { name: "m_mat4x2", align: 8, size: 32 },
      { name: "m_mat2x3", align: 16, size: 32 },
      { name: "m_mat3x3", align: 16, size: 48 },
      { name: "m_mat4x3", align: 16, size: 64 },
      { name: "m_mat2x4", align: 16, size: 32 },
      { name: "m_mat3x4", align: 16, size: 48 },
      { name: "m_mat4x4", align: 16, size: 64 },
    ];
    test.equals(info.members.length, fields.length);

    const divisor = type === "f16" ? 2 : 1;
    let offset = 0;
    for (let i = 0; i < fields.length; ++i) {
      const { name, align, size } = fields[i];
      offset = roundUp(align / divisor, offset);

      const member = info.members[i];
      test.equals(member.name, name);
      test.equals(member.isStruct, false);
      test.equals(member.offset, offset);
      test.equals(member.size, size / divisor);
      offset += size;
    }
  }

  //test('test f16', (test) => testType(test, 'f16'));
  test("test f32", (test) => testType(test, "f32"));
  test("test i32", (test) => testType(test, "i32"));
  test("test u32", (test) => testType(test, "u32"));

  function testTypeAlias(test, suffix) {
    const shader = `
        struct Types {
            m_vec2: vec2${suffix},
            m_vec3: vec3${suffix},
            m_vec4: vec4${suffix},
            m_mat2x2: mat2x2${suffix},
            m_mat3x2: mat3x2${suffix},
            m_mat4x2: mat4x2${suffix},
            m_mat2x3: mat2x3${suffix},
            m_mat3x3: mat3x3${suffix},
            m_mat4x3: mat4x3${suffix},
            m_mat2x4: mat2x4${suffix},
            m_mat3x4: mat3x4${suffix},
            m_mat4x4: mat4x4${suffix},
        };
        @group(0) @binding(0) var<uniform> u: Types;
        `;
    console.log(shader);
    const reflect = new WgslReflect(shader);

    const info = reflect.getStructInfo(reflect.structs[0]);

    const fields = [
      { name: "m_vec2", align: 8, size: 8 },
      { name: "m_vec3", align: 16, size: 12 },
      { name: "m_vec4", align: 16, size: 16 },
      { name: "m_mat2x2", align: 8, size: 16 },
      { name: "m_mat3x2", align: 8, size: 24 },
      { name: "m_mat4x2", align: 8, size: 32 },
      { name: "m_mat2x3", align: 16, size: 32 },
      { name: "m_mat3x3", align: 16, size: 48 },
      { name: "m_mat4x3", align: 16, size: 64 },
      { name: "m_mat2x4", align: 16, size: 32 },
      { name: "m_mat3x4", align: 16, size: 48 },
      { name: "m_mat4x4", align: 16, size: 64 },
    ];
    test.equals(info.members.length, fields.length);

    const divisor = suffix === "h" ? 2 : 1;
    let offset = 0;
    for (let i = 0; i < fields.length; ++i) {
      const { name, align, size } = fields[i];
      offset = roundUp(align / divisor, offset);

      const member = info.members[i];
      test.equals(member.name, name);
      test.equals(member.isStruct, false);
      test.equals(member.offset, offset);
      test.equals(member.size, size / divisor);
      offset += size;
    }
  }

  //test('test h', (test) => testTypeAlias(test, 'h'));
  test("test f", (test) => testTypeAlias(test, "f"));
  test("test i", (test) => testTypeAlias(test, "i"));
  test("test u", (test) => testTypeAlias(test, "u"));

  test("override", function (test) {
    const shader = `
        @id(0) override workgroupSize: u32 = 42;
        @id(1) override PI: f32 = 3.14;
        `;

    const reflect = new WgslReflect(shader);
    test.equals(reflect.overrides.length, 2);

    let override = reflect.overrides[0];
    test.equals(override.name, "workgroupSize");
    test.equals(override.id, 0);
    test.equals(override.type.name, "u32");
    test.equals(override.declaration.toString(), "42");

    override = reflect.overrides[1];
    test.equals(override.name, "PI");
    test.equals(override.id, 1);
    test.equals(override.type.name, "f32");
    test.equals(override.declaration.toString(), "3.14");
  });

  test("@group(0) @binding(2) var myTexture: texture_external;", function (test) {
    const shader = `@group(0) @binding(2) var myTexture: texture_external;`;
    const reflect = new WgslReflect(shader);

    test.equals(reflect.textures.length, 1);
    test.equals(reflect.textures[0].name, "myTexture");
    test.equals(reflect.textures[0].type.name, "texture_external");
    test.equals(reflect.textures[0].group, 0);
    test.equals(reflect.textures[0].binding, 2);
  });
});
