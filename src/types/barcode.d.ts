interface DetectedBarcode {
  rawValue: string
  format: string
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats(): Promise<string[]>
}

interface Window {
  BarcodeDetector?: BarcodeDetectorConstructor
}
