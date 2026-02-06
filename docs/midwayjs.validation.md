校验规则
提示
新版本中已经移除了 RuleType 的使用，可以直接使用对应的验证器写法。
@Rule 装饰器可以传递不同类型的验证器的规则。
在 @Rule 装饰器中，使用 getSchema 方法，需要使用箭头函数。
常见的 joi 校验写法
import * as Joi from 'joi';

Joi.number().required(); // 数字，必填
Joi.string().empty(''); // 字符串非必填
Joi.number().max(10).min(1); // 数字，最大值和最小值
Joi.number().greater(10).less(50); // 数字，大于 10，小于 50

Joi.string().max(10).min(5); // 字符串，长度最大 10，最小 5
Joi.string().length(20); // 字符串，长度 20
Joi.string().pattern(/^[abc]+$/); // 字符串，匹配正则格式

Joi.object().length(5); // 对象，key 数量等于 5

Joi.array().items(Joi.string()); // 数组，每个元素是字符串
Joi.array().max(10); // 数组，最大长度为 10
Joi.array().min(10); // 数组，最小长度为 10
Joi.array().length(10); // 数组，长度为 10

Joi.string().allow(''); // 非必填字段传入空字符串

export enum DeviceType {
  iOS = 'ios',
  Android = 'android',
}
Joi.string().valid(...Object.values(DeviceType)) // 根据枚举值校验

级联校验
Midway 支持每个校验的 Class 中的属性依旧是一个对象。

我们给 UserDTO 增加一个属性 school ，并且赋予一个 SchoolDTO 类型。

import { Rule, getSchema } from '@midwayjs/validation';
import * as Joi from 'joi';

export class SchoolDTO {
  @Rule(Joi.string().required())
  name: string;
  @Rule(Joi.string())
  address: string;
}

export class UserDTO {
  @Rule(Joi.number().required())
  id: number;

  @Rule(Joi.string().required())
  firstName: string;

  @Rule(Joi.string().max(10))
  lastName: string;

  // 复杂对象
  // 这里执行的时候 validator 还未注册，所以需要使用箭头函数
  @Rule(() => getSchema(SchoolDTO).required())
  school: SchoolDTO;

  // 对象数组
  @Rule(() => Joi.array().items(getSchema(SchoolDTO)).required())
  schoolList: SchoolDTO[];
}

这个时候， @Rule 装饰器的参数可以为需要校验的这个类型本身。

继承校验
Midway 支持校验继承方式，满足开发者抽离通用的对象属性的时候做参数校验。

例如我们下面 CommonUserDTO 抽离接口的通用的一些属性，然后 UserDTO 作为特殊接口需要的特定参数。

import { Rule } from '@midwayjs/validation';

export class CommonUserDTO {
  @Rule(Joi.string().required())
  token: string;
  @Rule(Joi.string())
  workId: string;
}

export class UserDTO extends CommonUserDTO {
  @Rule(Joi.string().required())
  name: string;
}

老版本需要在子类上面加，新版本不需要啦～

信息
如果属性名相同，则取当前属性的规则进行校验，不会和父类合并。

多类型校验
从 v3.4.5 开始，Midway 支持某个属性的不同类型的校验。

例如某个类型，既可以是可以普通类型，又可以是一个复杂类型。

import { Rule, getSchema } from '@midwayjs/validation';
import * as Joi from 'joi';

export class SchoolDTO {
  @Rule(Joi.string().required())
  name: string;
  @Rule(Joi.string())
  address: string;
}

export class UserDTO {
  @Rule(Joi.string().required())
  name: string;

  @Rule(() => Joi.alternatives([Joi.string(), getSchema(SchoolDTO)]).required())
  school: string | SchoolDTO;
}

我们可以使用 getSchema 方法，从某个 DTO 拿到当前的 schema，从而进行复杂的逻辑处理。

从原有 DTO 创建新 DTO
有时候，我们会希望从某个 DTO 中获取一部分属性，变成一个新的 DTO 类。

Midway 提供了 PickDto 和 OmitDto 两个方法根据现有的的 DTO 类型创建新的 DTO。

PickDto 用于从现有的 DTO 中获取一些属性，变成新的 DTO，而 OmitDto 用于将其中某些属性剔除，比如：

// src/dto/user.ts
import { Rule, PickDto } from '@midwayjs/validation';

export class UserDTO {
  @Rule(Joi.number().required())
  id: number;

  @Rule(Joi.string().required())
  firstName: string;

  @Rule(Joi.string().max(10))
  lastName: string;

  @Rule(Joi.number().max(60))
  age: number;
}

// 继承出一个新的 DTO
export class SimpleUserDTO extends PickDto(UserDTO, ['firstName', 'lastName']) {}

// const simpleUser = new SimpleUserDTO();
// 只包含了 firstName 和 lastName 属性
// simpleUser.firstName = xxx

export class NewUserDTO extends OmitDto(UserDTO, ['age']) {}

// const newUser = new NewUserDTO();
// newUser.age 定义和属性都不存在

// 使用
async login(@Body() user: NewUserDTO) {
  // ...
}

如果你选择使用 Zod v4 验证器，需要先安装相关依赖包：

$ npm i @midwayjs/validation@4 @midwayjs/validation-zod4@4 zod@4 --save

在配置文件中设置验证器：

// src/config/config.default.ts
import zod from '@midwayjs/validation-zod4';

export default {
  // ...
  validation: {
    // 配置验证器
    validators: {
      'zod': zod,
    },
    // 设置默认验证器
    defaultValidator: 'zod'
  }
}

可以直接使用 Zod 的验证规则：

import { Rule } from '@midwayjs/validation';
import { z } from 'zod';

export class UserDTO {
  @Rule(z.number().min(1))
  id: number;

  @Rule(z.string().min(1))
  firstName: string;

  @Rule(z.string().max(10))
  lastName: string;

  @Rule(z.number().max(60))
  age: number;
}