import React, { useRef, useState } from "react"
import {
  Stage,
  Layer,
  Rect,
  Transformer,
  Image as KonvaImage,
} from "react-konva"
import * as pdfjsLib from "pdfjs-dist"
import "pdfjs-dist/legacy/build/pdf.worker.mjs"
import { useImage } from "react-konva-utils"
// import jsPDF from 'jspdf';
import { Container, Form, OverlayTrigger, Row, Tooltip } from "react-bootstrap"
import { PDFDocument, rgb } from "pdf-lib"
import LoadingSpinner from "./componenst/LoadingSpinner"
import "./App.css"
import UndoIcon from "./icons/UndoIcon"
import EraserIcon from "./icons/EraserIcon"
import FloppyIcon from "./icons/FloppyIcon"
import SendFileModal from "./componenst/Modals/SendFileModal"
import SendIcon from "./icons/SendIcon"

interface RectProps {
  id: string // Zmiana na 'string'
  x: number
  y: number
  width: number
  height: number
  page: number
}

const App: React.FC = () => {
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [rects, setRects] = useState<RectProps[]>([])
  const [history, setHistory] = useState<RectProps[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [startExport, setStartExport] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  )
  // const stageRefs = useRef<any[]>([]);
  const transformerRef = useRef<any>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [openModal, setOpenModal] = useState<boolean>(false)

  const pageWidth = 768
  const pageHeight = 1024

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          const typedArray = new Uint8Array(ev.target.result as ArrayBuffer)
          // console.log('PDF Data:', typedArray); // Sprawdź, co zawiera
          await loadPdf(typedArray) // Ładujemy PDF do podglądu
        }
      }
      setFileName(file.name)
      reader.readAsArrayBuffer(file)
    } else {
      alert("Wybrany plik nie jest plikiem PDF.")
    }
  }

  const loadPdf = async (pdfData: Uint8Array) => {
    setLoading(true)
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
    const pages: string[] = []
    // const scale = 2.0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (context) {
        canvas.height = viewport.height
        canvas.width = viewport.width
        await page.render({ canvasContext: context, viewport }).promise
        pages.push(canvas.toDataURL())
      }
    }
    setLoading(false)
    setPdfPages(pages)
  }

  const handleMouseDown = (e: any, page: number) => {
    const pos = e.target.getStage()?.getPointerPosition()
    if (pos) {
      setIsDrawing(true)
      setStartPoint({ x: pos.x, y: pos.y })
    }
  }

  const handleMouseMove = (e: any, page: number) => {
    if (!isDrawing || !startPoint) return

    const pos = e.target.getStage()?.getPointerPosition()
    if (pos) {
      const newRect = {
        id: "temp",
        x: startPoint.x,
        y: startPoint.y,
        width: pos.x - startPoint.x,
        height: pos.y - startPoint.y,
        page,
      }

      setRects((prev) => {
        const updated = [...prev]
        updated.pop()
        updated.push(newRect)
        return updated
      })
    }
  }

  const handleMouseUp = (e: any, page: number) => {
    if (!isDrawing || !startPoint) return

    const pos = e.target.getStage()?.getPointerPosition()
    if (pos) {
      const newRect = {
        id: rects.length.toString(),
        x: startPoint.x,
        y: startPoint.y,
        width: pos.x - startPoint.x,
        height: pos.y - startPoint.y,
        page,
      }

      setRects((prev) => [...prev, newRect])
      setHistory([...rects, newRect])
    }

    setIsDrawing(false) // Upewnij się, że rysowanie się kończy
    setStartPoint(null)
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
  }

  const handleExport = async () => {
    setStartExport(true)

    // Tworzymy nowy dokument PDF
    const pdfDoc = await PDFDocument.create()

    // Ustal wymiary strony PDF
    const pageWidth = 768
    const pageHeight = 1024

    // Ustal środek strony
    const centerX = pageWidth / 2
    const centerY = pageHeight / 2

    // Załaduj każdą stronę z oryginalnego PDF
    for (const [index, src] of pdfPages.entries()) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]) // Dodajemy nową stronę o wymiarach 768x1024

      // Ustal wymiary obrazu na podstawie oryginalnego PDF
      const imageBytes = await fetch(src).then((res) => res.arrayBuffer())
      const image = await pdfDoc.embedPng(imageBytes)
      const { width, height } = image.scale(1)

      // Rysujemy obraz PDF na stronie, dostosowując jego położenie
      const scaleFactor = Math.min(pageWidth / width, pageHeight / height)
      const imgWidth = width * scaleFactor
      const imgHeight = height * scaleFactor

      const xOffset = centerX - imgWidth / 2 // Wyśrodkowanie obrazu
      const yOffset = centerY - imgHeight / 2 // Wyśrodkowanie obrazu

      page.drawImage(image, {
        x: xOffset,
        y: yOffset,
        width: imgWidth,
        height: imgHeight,
      })

      // Rysujemy prostokąty, skalując ich położenie i rozmiar
      const rectsOnPage = rects.filter((rect) => rect.page === index)
      for (const rect of rectsOnPage) {
        // Określanie wymarów prostokąta względem rozmiaru image
        const scaledX = xOffset + (rect.x / pageWidth) * imgWidth
        const scaledY = yOffset + imgHeight - (rect.y / pageHeight) * imgHeight
        const scaledWidth = (rect.width / pageWidth) * imgWidth
        const scaledHeight = (rect.height / pageHeight) * imgHeight

        // Rysowanie prostokąta zaktualizowanymi wartościami
        page.drawRectangle({
          x: scaledX,
          y: scaledY - scaledHeight,
          // width: rect.width,
          width: scaledWidth,
          // height: rect.height,
          height: scaledHeight,
          color: rgb(0, 0, 0), // Czarny kolor prostokąta
        })
      }
    }

    // Zapisz zanonimizowany PDF jako blob
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: "application/pdf" })
    setStartExport(false)
    setPdfBlob(blob)

    // Utwórz link do pobrania
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `${fileName}-anonymized.pdf`;
    // setStartExport(false);
    // a.click();
    // URL.revokeObjectURL(url); // Zwolnij obiekt URL
  }

  const handleUndo = () => {
    if (rects.length <= 0) return
    console.log("undo")
    const updatedRecst = rects.slice(0, -1)
    setRects(updatedRecst)
    setHistory(updatedRecst)
  }

  const handleClear = () => {
    setRects([])
    setHistory([])
  }

  const handleOpenModal = () => {
    handleExport()
    setOpenModal(true)
  }

  if (loading) return <LoadingSpinner message="Ładowanie pliku PDF..." />
  if (startExport)
    return <LoadingSpinner message="Przygotowywanie pliku PDF..." />

  return (
    <div>
      <Container className="bg-light">
        <Row>
          <h1>Anonimizacja PDF</h1>
          <Form.Control
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="my-3"
          />
          {pdfPages.length > 0 && (
            <div className="anonimize-buttons ">
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={<Tooltip>Cofnij</Tooltip>}
              >
                <button
                  onClick={() => handleUndo()}
                  className="anonim-btn anonim-btn-success shadow"
                >
                  <UndoIcon />
                </button>
              </OverlayTrigger>
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={<Tooltip>Wyczyść</Tooltip>}
              >
                <button
                  onClick={handleClear}
                  className="anonim-btn anonim-btn-info shadow"
                >
                  <EraserIcon />
                </button>
              </OverlayTrigger>
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={<Tooltip>Dalej</Tooltip>}
              >
                <button
                  // onClick={handleExport}
                  onClick={handleOpenModal}
                  className="anonim-btn anonim-btn-danger shadow"
                  disabled={pdfPages.length === 0}
                >
                  <SendIcon />
                </button>
              </OverlayTrigger>
            </div>
          )}

          {pdfPages.map((src, index) => (
            <div key={index} className="d-flex justify-content-center">
              <Stage
                // key={index}
                width={pageWidth}
                height={pageHeight}
                // ref={(el) => (stageRefs.current[index] = el)}
                // onClick={(e) => handleStageClick(e, index)}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onMouseMove={(e) => handleMouseMove(e, index)}
                onMouseUp={(e) => handleMouseUp(e, index)}
                style={{ border: "1px solid black", marginTop: "10px" }}
              >
                <Layer className="border">
                  <PdfPageImage
                    src={src}
                    width={pageWidth}
                    height={pageHeight}
                  />
                  {rects
                    .filter((rect) => rect.page === index)
                    .map((rect, i) => (
                      <Rect
                        key={i}
                        {...rect}
                        fill="black"
                        draggable
                        onClick={() => handleSelect(rect.id)} // Bez zmian, 'id' jest już typu 'string'
                        ref={selectedId === rect.id ? transformerRef : null}
                      />
                    ))}
                  {isDrawing && startPoint && (
                    <Rect
                      x={startPoint.x}
                      y={startPoint.y}
                      width={rects[rects.length - 1]?.width || 0} // Użyj ostatniego prostokąta
                      height={rects[rects.length - 1]?.height || 0} // Użyj ostatniego prostokąta
                      fill="black"
                      opacity={0.5} // Tymczasowy prostokąt
                    />
                  )}
                  {selectedId && (
                    <Transformer
                      ref={transformerRef}
                      boundBoxFunc={(newBox) => newBox}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          ))}
          <SendFileModal
            isOpen={openModal}
            onClose={() => setOpenModal(false)}
            pdfBlob={pdfBlob}
          />
        </Row>
      </Container>
    </div>
  )
}

const PdfPageImage: React.FC<{
  src: string
  width: number
  height: number
}> = ({ src, width, height }) => {
  const [image] = useImage(src)
  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      stroke={"black"}
      strokeEnabled
      strokeHitEnabled
    />
  )
}

export default App
