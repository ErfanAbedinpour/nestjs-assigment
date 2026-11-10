import type { SchemaObject, StandardSchemaConverter } from '@nestjs/swagger';

type JoiRule = {
  name: string;
  args?: { limit?: number; regex?: string };
};

type JoiDescription = {
  type?: string;
  flags?: {
    presence?: string;
    description?: string;
    default?: string | number;
    only?: boolean;
  };
  rules?: JoiRule[];
  keys?: Record<string, JoiDescription>;
  allow?: unknown[];
  examples?: unknown[];
};

/**
 * Joi can emit JSON Schema draft 2020-12, which @nestjs/swagger does not ask for.
 * This converts the schemas already attached to @Body and @Query into OpenAPI 3.0
 * so document generation does not crash, and the published contract stays the validated one.
 */
export const joiOpenApiConverter: StandardSchemaConverter = (schema) => {
  if (!isJoiSchema(schema)) return undefined;
  return { schema: toOpenApi(schema.describe()) };
};

function isJoiSchema(schema: unknown): schema is { describe: () => JoiDescription } {
  if (typeof schema !== 'object' || schema === null) return false;
  if (!('describe' in schema) || typeof schema.describe !== 'function') return false;
  if (!('~standard' in schema)) return false;
  const standard = schema['~standard'];
  return (
    typeof standard === 'object' &&
    standard !== null &&
    'vendor' in standard &&
    standard.vendor === 'joi'
  );
}

function toOpenApi(description: JoiDescription): SchemaObject {
  if (description.type === 'object') return objectSchema(description);
  if (description.type === 'number') return numberSchema(description);
  if (description.type === 'date')
    return annotated({ type: 'string', format: 'date-time' }, description);
  return stringSchema(description);
}

function objectSchema(description: JoiDescription): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];
  for (const [name, child] of Object.entries(description.keys ?? {})) {
    properties[name] = toOpenApi(child);
    if (child.flags?.presence === 'required') required.push(name);
  }
  return annotated(
    {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    description,
  );
}

function stringSchema(description: JoiDescription): SchemaObject {
  const schema: SchemaObject = { type: 'string' };
  if (description.flags?.only === true && description.allow !== undefined) {
    schema.enum = description.allow.filter(
      (value): value is string => typeof value === 'string',
    );
  }
  for (const rule of description.rules ?? []) {
    if (rule.name === 'min' && rule.args?.limit !== undefined)
      schema.minLength = rule.args.limit;
    if (rule.name === 'max' && rule.args?.limit !== undefined)
      schema.maxLength = rule.args.limit;
    if (rule.name === 'email') schema.format = 'email';
    if (rule.name === 'guid') schema.format = 'uuid';
    if (rule.name === 'pattern') {
      const pattern = openApiPattern(rule.args?.regex);
      if (pattern !== undefined) schema.pattern = pattern;
    }
  }
  return annotated(schema, description);
}

function numberSchema(description: JoiDescription): SchemaObject {
  const integer = (description.rules ?? []).some((rule) => rule.name === 'integer');
  const schema: SchemaObject = { type: integer ? 'integer' : 'number' };
  for (const rule of description.rules ?? []) {
    if (rule.name === 'min' && rule.args?.limit !== undefined)
      schema.minimum = rule.args.limit;
    if (rule.name === 'max' && rule.args?.limit !== undefined)
      schema.maximum = rule.args.limit;
  }
  return annotated(schema, description);
}

function annotated(schema: SchemaObject, description: JoiDescription): SchemaObject {
  if (description.flags?.description !== undefined) {
    schema.description = description.flags.description;
  }
  const example = description.examples?.[0];
  if (typeof example === 'string' || typeof example === 'number')
    schema.example = example;
  if (
    description.flags?.default !== undefined &&
    (typeof description.flags.default === 'string' ||
      typeof description.flags.default === 'number')
  ) {
    schema.default = description.flags.default;
  }
  return schema;
}

function openApiPattern(regex: string | undefined): string | undefined {
  if (regex === undefined) return undefined;
  const wrapped = /^\/(.+)\/[a-z]*$/.exec(regex);
  return wrapped?.[1] ?? regex;
}
