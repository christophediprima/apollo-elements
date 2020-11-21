import type { DefinitionNode, OperationDefinitionNode, VariableDefinitionNode } from 'graphql';
import type { Operation } from '@apollo/client/core';

/** isOperationDefinition :: DefinitionNode -> Boolean */
function isOperationDefinition(definition: DefinitionNode): definition is OperationDefinitionNode {
  return definition.kind === 'OperationDefinition';
}

/** isNonNullType :: a -> Boolean */
function isNonNullType<T extends { type: { kind: string } }>(x: T) {
  return x?.type?.kind === 'NonNullType';
}

/** hasNonNullValue :: keyof TVariables VariableName => TVariables -> VariableName -> Boolean */
function hasNonNullValue<T = Record<string, unknown>>(x: T) {
  return (prop: keyof T): boolean =>
    x?.[prop] != null;
}

function isTrue(x: boolean): x is true {
  return x;
}

/** getVariableDefinitions :: OperationDefinitionNode -> [VariableDefinitionNode] */
function getVariableDefinitions(x: OperationDefinitionNode): readonly VariableDefinitionNode[] {
  return x.variableDefinitions;
}

/** getVariableValue :: VariableDefinitionNode -> a */
function getVariableValue(x: VariableDefinitionNode) {
  return x.variable.name.value;
}

/**
 * Checks whether an operation includes all its non-nullable variables
 *
 * hasAllVariables :: Operation -> Bool
 */
export function hasAllVariables(operation: Partial<Operation>): boolean {
  try {
    return operation.query.definitions
      .filter(isOperationDefinition)
      .flatMap(getVariableDefinitions)
      .filter(isNonNullType)
      .map(getVariableValue)
      .map(hasNonNullValue(operation.variables))
      .every(isTrue); /* c8 ignore next */ // this is covered
  } catch {
    return false;
  }
}
