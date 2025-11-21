const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on", "all", "*"]);

type FlagValue = string | boolean | undefined | null;

const DEFAULT_FALLBACK = ["http://localhost:3000"];

function normalizeListValue(value?: string | null): string {
    if (!value) {
        return "";
    }
    let normalized = value.trim();
    if (normalized.startsWith("[") && normalized.endsWith("]")) {
        normalized = normalized.slice(1, -1);
    }
    return normalized;
}

export function isAllOriginsEnabled(flag?: FlagValue): boolean {
    if (typeof flag === "boolean") {
        return flag;
    }
    if (!flag) {
        return false;
    }
    return TRUE_VALUES.has(flag.toString().trim().toLowerCase());
}

export function parseOrigins(list?: string | null): string[] {
    const normalized = normalizeListValue(list);
    if (!normalized) {
        return [];
    }
    return normalized
        .split(",")
        .map((item) => item.replace(/["'`]/g, "").trim())
        .filter((item) => item.length > 0);
}

export function resolveAllowedOrigins(
    list?: string | null,
    allowAll?: FlagValue,
    fallback: string[] = DEFAULT_FALLBACK,
): true | string[] {
    if (isAllOriginsEnabled(allowAll)) {
        return true;
    }

    const parsed = parseOrigins(list);
    if (parsed.length > 0) {
        return parsed;
    }

    return fallback.length > 0 ? fallback : DEFAULT_FALLBACK;
}

export function expandToWebsocketOrigins(origins: string[]): string[] {
    const set = new Set<string>(origins);

    origins.forEach((origin) => {
        try {
            const url = new URL(origin);
            if (url.protocol === "http:") {
                set.add(`ws://${url.host}`);
            } else if (url.protocol === "https:") {
                set.add(`wss://${url.host}`);
            }
        } catch {
        }
    });

    return Array.from(set);
}

