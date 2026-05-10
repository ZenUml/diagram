export type SvgDimensions = {
    width?: number;
    height?: number;
};
export declare function normalizeSvg(svg: string, options: {
    title?: string;
    diagramType?: string | null;
}): Promise<string>;
export declare function getRootSvgDimensions(svg: string): SvgDimensions;
export declare function getZenumlContentWidth(svg: string): number | undefined;
