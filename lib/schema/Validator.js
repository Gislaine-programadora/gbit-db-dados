'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ValidationError extends Error {
  constructor(errors) {
    super(`Falha de validação: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Valida um documento contra um Schema. Retorna { valid, errors }.
 * Suporta: type, required, min, max, minLength, maxLength, pattern,
 * format ('email'), enum.
 */
class Validator {
  static validate(doc, schema) {
    const errors = [];
    if (!schema || schema.fields.length === 0) {
      return { valid: true, errors: [] };
    }

    for (const field of schema.fields) {
      const rule = schema.definition[field];
      const value = doc[field];
      const has = value !== undefined && value !== null;

      if (rule.required && !has) {
        errors.push(`campo "${field}" é obrigatório`);
        continue;
      }
      if (!has) continue;

      if (rule.type && !Validator._checkType(value, rule.type)) {
        errors.push(`campo "${field}" deve ser do tipo ${rule.type}`);
        continue;
      }

      if (rule.type === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(`campo "${field}" deve ter no mínimo ${rule.minLength} caracteres`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push(`campo "${field}" deve ter no máximo ${rule.maxLength} caracteres`);
        }
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`campo "${field}" não corresponde ao padrão esperado`);
        }
        if (rule.format === 'email' && !EMAIL_RE.test(value)) {
          errors.push(`campo "${field}" deve ser um e-mail válido`);
        }
      }

      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`campo "${field}" deve ser >= ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`campo "${field}" deve ser <= ${rule.max}`);
        }
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`campo "${field}" deve ser um de: ${rule.enum.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static assert(doc, schema) {
    const { valid, errors } = Validator.validate(doc, schema);
    if (!valid) throw new ValidationError(errors);
  }

  static _checkType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || !Number.isNaN(Date.parse(value));
      default:
        return true;
    }
  }
}

module.exports = { Validator, ValidationError };
