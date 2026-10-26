// Interleaved 2 of 5 patterns (n = narrow, w = wide), the symbology of Brazilian boletos.
const PATTERNS = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"];
const NARROW = 1;
const WIDE = 3;

/** Renders the 44-digit boleto bar code as SVG. */
export function BoletoBarcode({ value, height = 56 }: { value: string; height?: number }) {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length % 2 !== 0) return null;

  // Each module: [isBar, width]
  const modules: Array<[boolean, number]> = [
    [true, NARROW],
    [false, NARROW],
    [true, NARROW],
    [false, NARROW],
  ];
  for (let index = 0; index < digits.length; index += 2) {
    const bars = PATTERNS[Number(digits[index])];
    const spaces = PATTERNS[Number(digits[index + 1])];
    for (let position = 0; position < 5; position += 1) {
      modules.push([true, bars[position] === "w" ? WIDE : NARROW]);
      modules.push([false, spaces[position] === "w" ? WIDE : NARROW]);
    }
  }
  modules.push([true, WIDE], [false, NARROW], [true, NARROW]);

  let x = 0;
  const rects = modules.map(([isBar, width], index) => {
    const rect = isBar ? <rect fill="#000" height={height} key={index} width={width} x={x} y={0} /> : null;
    x += width;
    return rect;
  });

  return (
    <svg
      aria-label={`Codigo de barras ${digits}`}
      className="h-14 w-full"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${x} ${height}`}
    >
      {rects}
    </svg>
  );
}
