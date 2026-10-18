export const getGridDimensions = (
  listLength: number,
  customColumns?: number
) => {
  let gridWidth: number
  let gridHeight: number

  // Missing optional storage values can arrive as null at runtime. Treat any
  // invalid value as automatic sizing instead of producing an unusable grid.
  if (
    typeof customColumns === "number" &&
    Number.isFinite(customColumns) &&
    customColumns >= 1
  ) {
    gridWidth = customColumns
    gridHeight = Math.max(1, Math.ceil(listLength / gridWidth))
  } else {
    gridWidth = Math.max(1, Math.ceil(Math.sqrt(listLength)))
    gridHeight = Math.max(1, Math.ceil(listLength / gridWidth))
  }

  return { gridWidth, gridHeight }
}
