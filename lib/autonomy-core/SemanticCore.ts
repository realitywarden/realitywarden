import type { SemanticIntent } from './SemanticIntent';

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export class SemanticCore {
  parse(prompt: string): SemanticIntent {
    const normalized = prompt.trim().toLowerCase();
    const object_query = hasAny(normalized, ['blue cube', 'blue block', 'blue_cube', '\u84dd\u8272', '\u84dd\u65b9\u5757'])
      ? 'blue cube'
      : hasAny(normalized, ['red cube', 'red block', 'red_cube', '\u7ea2\u8272', '\u7ea2\u65b9\u5757'])
        ? 'red cube'
        : hasAny(normalized, ['cube', 'block', '\u65b9\u5757'])
          ? 'cube'
          : null;
    const target_query = hasAny(normalized, ['outside table', 'off table', '\u684c\u9762\u5916', '\u6254\u51fa\u684c\u9762', '\u4e22\u51fa\u684c\u9762'])
      ? 'outside table'
      : hasAny(normalized, ['glass cup area', 'near glass cup', 'glass cup', '\u73bb\u7483\u676f\u65c1', '\u73bb\u7483\u676f\u9644\u8fd1'])
        ? 'glass cup area'
        : hasAny(normalized, ['back safe zone', 'back zone', 'back area', 'back side', 'rear safe zone', 'rear zone', 'rear area', 'rear side', '\u540e\u65b9', '\u540e\u4fa7', '\u540e\u9762'])
          ? 'back area'
          : hasAny(normalized, ['front safe zone', 'front zone', 'front area', 'front side', '\u524d\u65b9', '\u524d\u4fa7', '\u524d\u9762'])
            ? 'front area'
            : hasAny(normalized, ['left safe zone', 'left zone', 'left area', 'left side', '\u5de6\u4fa7', '\u5de6\u8fb9'])
              ? 'left area'
              : hasAny(normalized, ['right safe zone', 'right zone', 'right area', 'right side', '\u53f3\u4fa7', '\u53f3\u8fb9'])
                ? 'right area'
                : null;
    const goal = hasAny(normalized, ['throw', '\u6254', '\u629b', '\u4e22'])
      ? 'throw_object'
      : hasAny(normalized, ['organize', 'tidy', '\u6574\u7406'])
        ? 'organize_workspace'
        : hasAny(normalized, ['home', '\u56de\u5230\u539f\u70b9', '\u56de\u539f\u70b9'])
          ? 'return_home'
          : hasAny(normalized, ['inspect', 'look', '\u68c0\u67e5', '\u89c2\u5bdf'])
            ? 'inspect'
            : 'move_object';

    const confidence = object_query || target_query || goal !== 'move_object' ? 0.86 : 0.45;
    return { goal, object_query, target_query, confidence, raw_prompt: prompt };
  }
}
