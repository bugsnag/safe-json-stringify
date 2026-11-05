declare module '@bugsnag/safe-json-stringify' {
      /**
     * Safely converts a JavaScript object to a JSON string.
     * If the object contains circular references, they will be replaced with `[Circular]`.
     *
     * @param value - The value to stringify.
     * @param replacer - A function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting/filtering the properties of the value object to be included in the JSON string.
     * @param space - A String or Number object that's used to insert white space into the output JSON string for readability purposes.
     * @param options - An object containing options for redacting keys and paths.
     * @param options.redactedKeys - An array of keys or regular expressions that should be redacted from the output.
     * @param options.redactedPaths - An array of strings representing paths to properties that should be redacted from the output.
     * @param options.maxBytes - Optional conservative UTF-8 byte budget for compact JSON; throws ERR_JSON_SIZE when exceeded. Cannot be combined with replacer or space.
     * @returns The JSON string representation of the value.
     */
    function stringify(
        value: any,
        replacer?: ((this: any, key: string, value: any) => any) | null | undefined,
        space?: string | number | null | undefined,
        options?: {
            redactedKeys?: Array<string | RegExp>;
            redactedPaths?: string[];
            maxBytes?: number;
        }
    ): string;
    namespace stringify {
        const supportsMaxBytes: true;
    }
    export default stringify;
}
