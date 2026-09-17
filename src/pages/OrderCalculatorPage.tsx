import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormField } from '../components/common/FormField'
import { MoneyInput } from '../components/common/MoneyInput'
import { CalculatorMaterialHintPanel } from '../components/orders/CalculatorMaterialHintPanel'
import { supabase } from '../lib/supabaseClient'
import { getErrorMessage, formatMoney, formatNumber, formatDate } from '../lib/formatters'
import { calculateQuote } from '../lib/calculator'
import type { CalculatorConfig, GlueLineConfig, GlueLineType, ResolvedLayer } from '../lib/calculator'
import { useClients, useUpsertClient } from '../hooks/useClients'
import { useFinishedProducts, useUpsertProduct } from '../hooks/useFinishedProducts'
import { useRawMaterials } from '../hooks/useRawMaterials'
import { useDies, useUpsertDie } from '../hooks/useDies'
import { useClientOrders, useCreateOrderWithCalculator } from '../hooks/useOrders'
import { useProductionSettings, useGlueMaterials } from '../hooks/useProductionSettings'
import { useClientProductHistory, useCreateTechCard } from '../hooks/useTechCards'

const OPERATION_DEFAULTS: Record<string, boolean> = {
  corrugator: true,
  flexo: false,
  slotter: false,
  die1: true,
  die2: false,
  lamination: false,
  auto_glue: true,
  manual_glue: false,
  packing: true,
}

export function OrderCalculatorPage() {
  const navigate = useNavigate()
  const { data: settings } = useProductionSettings()
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useFinishedProducts()
  const { data: materials = [] } = useRawMaterials()
  const { data: dies = [] } = useDies()
  const { data: glueMaterials } = useGlueMaterials()

  const upsertClient = useUpsertClient()
  const upsertProduct = useUpsertProduct()
  const upsertDie = useUpsertDie()
  const createOrder = useCreateOrderWithCalculator()
  const createTechCard = useCreateTechCard()

  const boardMaterials = useMemo(() => materials.filter((m) => m.grammage != null), [materials])

  // --- client / product / die selection ---
  const [clientId, setClientId] = useState('')
  const [newClient, setNewClient] = useState<{ name: string; company: string; phone: string } | null>(null)
  const [productId, setProductId] = useState('')
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [dieId, setDieId] = useState('')
  const [isNewDie, setIsNewDie] = useState(false)
  const [newDieName, setNewDieName] = useState('')

  const { data: clientOrders = [] } = useClientOrders(clientId || undefined)
  const { data: history = [] } = useClientProductHistory(clientId || undefined, productId || undefined)
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null)

  const suggestedProductIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of clientOrders) {
      counts.set(order.product_id, (counts.get(order.product_id) ?? 0) + 1)
    }
    return counts
  }, [clientOrders])

  const sortedProducts = useMemo(() => {
    const suggested = products
      .filter((p) => suggestedProductIds.has(p.id))
      .sort((a, b) => (suggestedProductIds.get(b.id) ?? 0) - (suggestedProductIds.get(a.id) ?? 0))
    const rest = products.filter((p) => !suggestedProductIds.has(p.id))
    return { suggested, rest }
  }, [products, suggestedProductIds])

  // --- step 1: format & run ---
  const [basis, setBasis] = useState<CalculatorConfig['basis']>('sheet')
  const [sheetWidth, setSheetWidth] = useState(720)
  const [sheetHeight, setSheetHeight] = useState(600)
  const [boxesPerSheet, setBoxesPerSheet] = useState(2)
  const [length, setLength] = useState(580)
  const [width, setWidth] = useState(395)
  const [height, setHeight] = useState(390)
  const [construction, setConstruction] = useState<CalculatorConfig['construction']>('0201')
  const [glueFlap, setGlueFlap] = useState(40)
  const [quantity, setQuantity] = useState(1000)
  const [waste, setWaste] = useState(0)

  // --- step 2: board & glue ---
  const [boardType, setBoardType] = useState<CalculatorConfig['boardType']>('3')
  const [layerPicks, setLayerPicks] = useState<{ raw_material_id: string; factor: number }[]>([
    { raw_material_id: '', factor: 1 },
    { raw_material_id: '', factor: 1.5 },
    { raw_material_id: '', factor: 1 },
    { raw_material_id: '', factor: 1.5 },
    { raw_material_id: '', factor: 1 },
  ])
  const [readyMaterialId, setReadyMaterialId] = useState('')
  const [glueLineTypes, setGlueLineTypes] = useState<GlueLineType[]>(['starch', 'starch', 'starch', 'starch'])

  // --- step 3: print & route ---
  const [printType, setPrintType] = useState<CalculatorConfig['printType']>('none')
  const [colors, setColors] = useState(0)
  const [printRate, setPrintRate] = useState(0)
  const [plateFee, setPlateFee] = useState(0)
  const [activeOperations, setActiveOperations] = useState<Record<string, boolean>>(OPERATION_DEFAULTS)

  // --- step 4: price & conditions ---
  const [pricingMode, setPricingMode] = useState<CalculatorConfig['pricingMode']>('margin')
  const [margin, setMargin] = useState(15)
  const [manualPrice, setManualPrice] = useState(0)
  const [vat, setVat] = useState(12)
  const [rounding, setRounding] = useState(0.01)
  const [logistics, setLogistics] = useState(0)
  const [deliveryCost, setDeliveryCost] = useState(0)
  const [leadTime, setLeadTime] = useState(10)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'management' | 'sales'>('management')

  useEffect(() => {
    document.title = 'Новый заказ — расчёт · EnzoPack'
  }, [])

  function resetForm() {
    setBasis('sheet')
    setSheetWidth(720)
    setSheetHeight(600)
    setBoxesPerSheet(2)
    setLength(580)
    setWidth(395)
    setHeight(390)
    setConstruction('0201')
    setGlueFlap(40)
    setQuantity(1000)
    setWaste(0)
    setBoardType('3')
    setLayerPicks([
      { raw_material_id: '', factor: 1 },
      { raw_material_id: '', factor: 1.5 },
      { raw_material_id: '', factor: 1 },
      { raw_material_id: '', factor: 1.5 },
      { raw_material_id: '', factor: 1 },
    ])
    setReadyMaterialId('')
    setGlueLineTypes(['starch', 'starch', 'starch', 'starch'])
    setPrintType('none')
    setColors(0)
    setPrintRate(0)
    setPlateFee(0)
    setActiveOperations(OPERATION_DEFAULTS)
    setPricingMode('margin')
    setMargin(15)
    setManualPrice(0)
    setVat(12)
    setRounding(0.01)
    setLogistics(0)
    setDeliveryCost(0)
    setLeadTime(10)
    setDeliveryDate('')
    setNotes('')
  }

  const activeLayerCount = boardType === 'ready' ? 1 : Number(boardType)
  const glueLineCount = Math.max(0, activeLayerCount - 1)

  const resolvedLayers: ResolvedLayer[] = useMemo(() => {
    if (boardType === 'ready') {
      const m = boardMaterials.find((x) => x.id === readyMaterialId)
      return [{ name: m?.name ?? 'Картон', grammage: Number(m?.grammage ?? 0), price: Number(m?.unit_price ?? 0), factor: 1 }]
    }
    return layerPicks.slice(0, activeLayerCount).map((pick, index) => {
      const m = boardMaterials.find((x) => x.id === pick.raw_material_id)
      return {
        name: m?.name ?? `Слой ${index + 1}`,
        grammage: Number(m?.grammage ?? 0),
        price: Number(m?.unit_price ?? 0),
        factor: pick.factor,
      }
    })
  }, [boardType, boardMaterials, readyMaterialId, layerPicks, activeLayerCount])

  const glueLineConfigs: GlueLineConfig[] = useMemo(
    () =>
      glueLineTypes.slice(0, glueLineCount).map((type, index) => ({
        type,
        enabled: type !== 'none',
        name: `Слой ${index + 1} ↔ ${index + 2}`,
      })),
    [glueLineTypes, glueLineCount],
  )

  const config: CalculatorConfig = useMemo(
    () => ({
      basis,
      sheetWidth,
      sheetHeight,
      boxesPerSheet,
      length,
      width,
      height,
      construction,
      glueFlap,
      quantity,
      waste,
      boardType,
      layers: resolvedLayers,
      glueLines: glueLineConfigs,
      activeOperations,
      printType,
      colors,
      printRate,
      plateFee,
      pricingMode,
      margin,
      manualPrice,
      vat,
      rounding,
      logistics,
      deliveryCost,
    }),
    [
      basis, sheetWidth, sheetHeight, boxesPerSheet, length, width, height, construction, glueFlap,
      quantity, waste, boardType, resolvedLayers, glueLineConfigs, activeOperations, printType,
      colors, printRate, plateFee, pricingMode, margin, manualPrice, vat, rounding, logistics, deliveryCost,
    ],
  )

  const result = useMemo(() => (settings ? calculateQuote(config, settings) : null), [config, settings])

  const hintMaterialIds = useMemo(
    () => (boardType === 'ready' ? [readyMaterialId] : layerPicks.slice(0, activeLayerCount).map((p) => p.raw_material_id)),
    [boardType, readyMaterialId, layerPicks, activeLayerCount],
  )

  const canSave =
    !!settings &&
    (clientId || newClient?.name) &&
    (isNewProduct ? newProductName : productId) &&
    quantity > 0

  async function handleSave() {
    if (!canSave || !result || !settings) return
    setSaving(true)
    try {
      let finalClientId = clientId
      if (!finalClientId && newClient?.name) {
        finalClientId = await upsertClient.mutateAsync({
          name: newClient.name,
          company: newClient.company || null,
          phone: newClient.phone || null,
        })
      }

      let finalDieId: string | null = dieId || null
      if (isNewDie && newDieName) {
        finalDieId = await upsertDie.mutateAsync({ name: newDieName, status: 'active' })
      }

      const rawConsumption = [
        ...result.materialDetails.map((m, index) => ({
          raw_material_id: boardType === 'ready' ? readyMaterialId : layerPicks[index]?.raw_material_id,
          qty_consumed: m.kg,
        })),
        ...result.glueDetails
          .filter((g) => g.type === 'starch' || g.type === 'liquid')
          .map((g) => ({
            raw_material_id: g.type === 'liquid' ? glueMaterials?.liquid?.id : glueMaterials?.starch?.id,
            qty_consumed: g.kg,
          })),
      ].filter((l): l is { raw_material_id: string; qty_consumed: number } => !!l.raw_material_id && l.qty_consumed > 0)

      // Two layers (or a layer + glue) can reference the same raw material —
      // merge quantities per material instead of inserting duplicate rows.
      const mergedByMaterial = new Map<string, number>()
      for (const line of rawConsumption) {
        mergedByMaterial.set(line.raw_material_id, (mergedByMaterial.get(line.raw_material_id) ?? 0) + line.qty_consumed)
      }
      const consumption = Array.from(mergedByMaterial.entries()).map(([raw_material_id, qty_consumed]) => ({
        raw_material_id,
        qty_consumed,
      }))

      let finalProductId = productId
      if (isNewProduct) {
        finalProductId = (await upsertProduct.mutateAsync({
          product: { name: newProductName, sale_price: result.saleVat, stock_qty: 0 },
          bom: [],
        })) as string
      }

      const orderId = await createOrder.mutateAsync({
        client_id: finalClientId,
        product_id: finalProductId,
        quantity: result.quantity,
        delivery_date: deliveryDate || null,
        unit_price: result.saleVat,
        notes: notes || undefined,
        consumption,
      })

      try {
        await createTechCard.mutateAsync({
          order_id: orderId,
          client_id: finalClientId,
          product_id: finalProductId,
          die_id: finalDieId,
          input_snapshot: config as unknown as Record<string, unknown>,
          result_snapshot: result as unknown as Record<string, unknown>,
          settings_snapshot: settings as unknown as Record<string, unknown>,
          total_cost: result.totalCost,
          unit_cost: result.unitCost,
          sale_price_vat: result.saleVat,
          margin_pct: result.actualMargin,
        })
      } catch (techCardError) {
        alert(
          `Заказ создан, но техкарта не сохранилась: ${getErrorMessage(techCardError)}. Заказ не затронут, сырьё пока не списано.`,
        )
      }

      navigate('/orders')
    } catch (error) {
      alert(`Не удалось создать заказ: ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const selectedClientName = clients.find((c) => c.id === clientId)?.name ?? newClient?.name ?? 'Не указан'
  const selectedProductName = isNewProduct ? newProductName : (products.find((p) => p.id === productId)?.name ?? '—')
  const boardSummary = resolvedLayers
    .map((layer) => `${layer.name} ${formatNumber(layer.grammage)} г/м²${layer.factor !== 1 ? ` ×${layer.factor}` : ''}`)
    .join(' • ')
  const printLabel =
    printType === 'none'
      ? 'Без печати'
      : printType === 'flexo'
        ? `Флексопечать, ${colors} цв.`
        : printType === 'offset'
          ? 'Офсетная печать'
          : 'Услуга печати'

  function copyOffer() {
    if (!result) return
    const text = [
      'Коммерческое предложение Enzo Pack',
      `Клиент: ${selectedClientName}`,
      `Изделие: ${selectedProductName || 'Гофрокороб'}`,
      `Формат: ${formatNumber(result.blank.w)} × ${formatNumber(result.blank.h)} мм`,
      `Площадь 1 коробки: ${result.areaPerBox.toFixed(3)} м²`,
      `Структура: ${boardSummary || '—'}`,
      `Печать: ${printLabel}`,
      `Тираж: ${formatNumber(result.quantity)} коробок`,
      `Цена без НДС: ${formatMoney(result.saleNoVat)}/шт.`,
      `Цена с НДС: ${formatMoney(result.saleVat)}/шт.`,
      `Итого с НДС: ${formatMoney(result.totalVat)}`,
      `Срок: ${leadTime} рабочих дней`,
    ].join('\n')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
  }

  function fallbackCopy(text: string) {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-14 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-brand-gray/95 backdrop-blur border-b border-brand-border flex items-center justify-between print:hidden">
        <div>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="text-xs text-brand-gray-dark hover:text-brand-ink transition mb-1"
          >
            ← Назад к заказам
          </button>
          <h1 className="text-xl font-bold text-brand-ink">Новый заказ — расчёт</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('management')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'management' ? 'bg-brand-black text-white' : 'text-brand-gray-dark'}`}
            >
              Управление
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sales')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'sales' ? 'bg-brand-black text-white' : 'text-brand-gray-dark'}`}
            >
              Продажи
            </button>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-gray-dark border border-brand-border hover:bg-brand-gray transition"
          >
            Сбросить заказ
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-gray-dark border border-brand-border hover:bg-brand-gray transition"
          >
            Печать / PDF
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-brand-gray-dark hover:bg-brand-gray transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50 hover:brightness-95 transition"
          >
            {saving ? 'Сохраняем…' : 'Создать заказ'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-5 print:block">
        <div className="flex flex-col gap-5 print:hidden">
          {/* Client + product + die */}
          <section className="border border-brand-border rounded-xl p-4 bg-white">
            <div className="text-sm font-semibold text-brand-ink mb-3">Клиент, товар, нож</div>

            <div className="mb-3">
              <span className="text-xs font-medium text-brand-gray-dark">Клиент</span>
              {!newClient ? (
                <div className="flex gap-2 mt-1">
                  <select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value)
                      setProductId('')
                    }}
                    className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                  >
                    <option value="">Выбрать клиента…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setNewClient({ name: '', company: '', phone: '' })}
                    className="text-xs font-semibold text-brand-yellow-dark whitespace-nowrap"
                  >
                    + новый
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-1 border border-brand-border rounded-lg p-3">
                  <FormField label="Имя клиента" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                  <FormField label="Компания" value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })} />
                  <FormField label="Телефон" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                  <button type="button" onClick={() => setNewClient(null)} className="text-xs text-brand-gray-dark self-start hover:underline">
                    Выбрать из списка вместо этого
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3">
              <span className="text-xs font-medium text-brand-gray-dark">Товар</span>
              {!isNewProduct ? (
                <div className="flex gap-2 mt-1">
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                  >
                    <option value="">Выбрать товар (по названию или коду)…</option>
                    {sortedProducts.suggested.length > 0 && (
                      <optgroup label="Уже заказывал(а) этот клиент">
                        {sortedProducts.suggested.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.code} {p.name} — заказывали ×{suggestedProductIds.get(p.id)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={sortedProducts.suggested.length > 0 ? 'Остальной каталог' : 'Каталог'}>
                      {sortedProducts.rest.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.code} {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsNewProduct(true)}
                    className="text-xs font-semibold text-brand-yellow-dark whitespace-nowrap"
                  >
                    + новый
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Название нового товара"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                  />
                  <button
                    type="button"
                    onClick={() => setIsNewProduct(false)}
                    className="text-xs text-brand-gray-dark self-center hover:underline whitespace-nowrap"
                  >
                    выбрать существующий
                  </button>
                </div>
              )}
              {clientId && productId && history.length > 0 && (
                <div className="mt-2 text-xs bg-brand-yellow-light text-brand-yellow-dark rounded-lg px-3 py-2">
                  Этот клиент уже заказывал этот товар {history.length} раз(а), последний —{' '}
                  {formatDate(history[0].created_at)}.{' '}
                  <button
                    type="button"
                    className="underline font-semibold"
                    onClick={() => setOpenHistoryId(history[0].id)}
                  >
                    Открыть прошлый расчёт
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs font-medium text-brand-gray-dark">Нож (штамп для высечки)</span>
              {!isNewDie ? (
                <div className="flex gap-2 mt-1">
                  <select
                    value={dieId}
                    onChange={(e) => setDieId(e.target.value)}
                    className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                  >
                    <option value="">Не выбран</option>
                    {dies.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.code} {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsNewDie(true)}
                    className="text-xs font-semibold text-brand-yellow-dark whitespace-nowrap"
                  >
                    + новый
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Название/номер ножа"
                    value={newDieName}
                    onChange={(e) => setNewDieName(e.target.value)}
                    className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                  />
                  <button
                    type="button"
                    onClick={() => setIsNewDie(false)}
                    className="text-xs text-brand-gray-dark self-center hover:underline whitespace-nowrap"
                  >
                    выбрать существующий
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Step 1: format & run */}
          <section className="border border-brand-border rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-brand-ink">01 · Формат и тираж</div>
              <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setBasis('sheet')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${basis === 'sheet' ? 'bg-white shadow-sm' : 'text-brand-gray-dark'}`}
                >
                  По листу
                </button>
                <button
                  type="button"
                  onClick={() => setBasis('box')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${basis === 'box' ? 'bg-white shadow-sm' : 'text-brand-gray-dark'}`}
                >
                  По коробке
                </button>
              </div>
            </div>

            {basis === 'sheet' ? (
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Ширина листа, мм" value={sheetWidth} onChange={setSheetWidth} />
                <NumField label="Длина листа, мм" value={sheetHeight} onChange={setSheetHeight} />
                <NumField label="Коробок с листа" value={boxesPerSheet} onChange={setBoxesPerSheet} />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <NumField label="Длина, мм" value={length} onChange={setLength} />
                <NumField label="Ширина, мм" value={width} onChange={setWidth} />
                <NumField label="Высота, мм" value={height} onChange={setHeight} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-brand-gray-dark">Конструкция</span>
                  <select
                    value={construction}
                    onChange={(e) => setConstruction(e.target.value as CalculatorConfig['construction'])}
                    className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                  >
                    <option value="0201">FEFCO 0201</option>
                    <option value="tray">Лоток</option>
                  </select>
                </label>
              </div>
            )}
            {basis === 'box' && (
              <div className="mt-3">
                <NumField label="Клапан склейки, мм" value={glueFlap} onChange={setGlueFlap} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumField label="Тираж, коробок" value={quantity} onChange={setQuantity} />
              <NumField label="Отход материала, %" value={waste} onChange={setWaste} />
            </div>

            {result && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-brand-border rounded-xl overflow-hidden mt-4">
                  <div className="bg-brand-black text-white p-3">
                    <div className="text-[10px] text-white/50">{basis === 'box' ? 'Формат развёртки' : 'Формат листа'}</div>
                    <div className="text-sm font-semibold">{formatNumber(result.blank.w)} × {formatNumber(result.blank.h)} мм</div>
                  </div>
                  <div className="bg-brand-black text-white p-3">
                    <div className="text-[10px] text-white/50">{basis === 'box' ? 'Площадь развёртки' : 'Площадь 1 листа'}</div>
                    <div className="text-sm font-semibold">{result.sheetArea.toFixed(3)} м²</div>
                  </div>
                  <div className="bg-brand-black text-white p-3">
                    <div className="text-[10px] text-white/50">Тираж листов</div>
                    <div className="text-sm font-semibold">{formatNumber(result.sheetRun)}</div>
                  </div>
                  <div className="bg-brand-black text-white p-3">
                    <div className="text-[10px] text-white/50">Общая площадь</div>
                    <div className="text-sm font-semibold">{formatNumber(result.totalArea)} м²</div>
                  </div>
                </div>

                <div className="mt-3 border border-brand-yellow/40 bg-brand-yellow-light/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold text-brand-ink border-b border-brand-yellow/30">
                    Выход с площади
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-brand-yellow/30">
                    <div className="p-3">
                      <div className="text-[10px] text-brand-gray-dark">Коробок с 1 листа</div>
                      <div className="text-sm font-semibold text-brand-ink">{formatNumber(result.boxesPerSheet)} шт.</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] text-brand-gray-dark">Площадь 1 коробки</div>
                      <div className="text-sm font-semibold text-brand-ink">{result.areaPerBox.toFixed(3)} м²</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] text-brand-gray-dark">Коробок с 1 м²</div>
                      <div className="text-sm font-semibold text-brand-ink">{result.boxesPerSquareMeter.toFixed(2)} шт.</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] text-brand-gray-dark">Коробок со 100 м²</div>
                      <div className="text-sm font-semibold text-brand-ink">{Math.floor(result.boxesPer100SquareMeters)} шт.</div>
                    </div>
                  </div>
                </div>

                {Math.min(result.blank.w, result.blank.h) <= 1350 ? (
                  <div className="mt-2 text-xs text-brand-gray-dark">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5" />
                    Формат проходит: подача {formatNumber(Math.min(result.blank.w, result.blank.h))} мм при рабочей ширине 1350 мм
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-red-600 font-medium">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
                    Не проходит: минимальная сторона {formatNumber(Math.min(result.blank.w, result.blank.h))} мм превышает 1350 мм
                  </div>
                )}
                <div className="mt-1 text-xs text-brand-gray-dark">
                  Расчётный выпуск: {formatNumber(result.calculatedOutput)} коробок • запас округления: {formatNumber(result.roundingReserve)}
                </div>
              </>
            )}
          </section>

          {/* Step 2: board & glue */}
          <section className="border border-brand-border rounded-xl p-4 bg-white">
            <div className="text-sm font-semibold text-brand-ink mb-3">02 · Картон, слои и клей</div>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-xs text-brand-gray-dark">Тип картона</span>
              <select
                value={boardType}
                onChange={(e) => setBoardType(e.target.value as CalculatorConfig['boardType'])}
                className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow max-w-xs"
              >
                <option value="3">3-слойный</option>
                <option value="5">5-слойный</option>
                <option value="ready">Покупной картон</option>
              </select>
            </label>

            {boardType === 'ready' ? (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-brand-gray-dark">Материал</span>
                <select
                  value={readyMaterialId}
                  onChange={(e) => setReadyMaterialId(e.target.value)}
                  className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow max-w-md"
                >
                  <option value="">Выбрать материал…</option>
                  {boardMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.code} {m.name} ({m.grammage} г/м²)
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {layerPicks.slice(0, activeLayerCount).map((pick, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-brand-gray-dark">{index + 1}.</span>
                    <select
                      value={pick.raw_material_id}
                      onChange={(e) => {
                        const next = [...layerPicks]
                        next[index] = { ...pick, raw_material_id: e.target.value }
                        setLayerPicks(next)
                      }}
                      className="flex-1 border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    >
                      <option value="">Материал…</option>
                      {boardMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          #{m.code} {m.name} ({m.grammage} г/м²)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={pick.factor}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const next = [...layerPicks]
                        next[index] = { ...pick, factor: Number(e.target.value) }
                        setLayerPicks(next)
                      }}
                      className="w-20 border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                      title="Коэффициент расхода"
                    />
                  </div>
                ))}
                {boardMaterials.length === 0 && (
                  <div className="text-xs text-brand-gray-dark sm:col-span-2">
                    В складе сырья нет материалов с заполненным граммажем — добавьте граммаж бумаге в разделе «Склад
                    сырья».
                  </div>
                )}
              </div>
            )}

            {glueLineCount > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-brand-gray-dark mb-1">Межслойный клей</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {glueLineTypes.slice(0, glueLineCount).map((type, index) => (
                    <select
                      key={index}
                      value={type}
                      onChange={(e) => {
                        const next = [...glueLineTypes]
                        next[index] = e.target.value as GlueLineType
                        setGlueLineTypes(next)
                      }}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    >
                      <option value="starch">Слой {index + 1}↔{index + 2}: крахмальный</option>
                      <option value="liquid">Слой {index + 1}↔{index + 2}: жидкое стекло</option>
                      <option value="none">Слой {index + 1}↔{index + 2}: не считать</option>
                    </select>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <CalculatorMaterialHintPanel
                result={result}
                materialIds={hintMaterialIds}
                glueMaterialIds={{ starch: glueMaterials?.starch?.id, liquid: glueMaterials?.liquid?.id }}
                materials={materials}
              />
            </div>
          </section>

          {/* Step 3: print & route */}
          <section className="border border-brand-border rounded-xl p-4 bg-white">
            <div className="text-sm font-semibold text-brand-ink mb-3">03 · Печать и маршрут</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-brand-gray-dark">Вид печати</span>
                <select
                  value={printType}
                  onChange={(e) => setPrintType(e.target.value as CalculatorConfig['printType'])}
                  className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                >
                  <option value="none">Без печати</option>
                  <option value="flexo">Флексопечать</option>
                  <option value="offset">Офсетная печать</option>
                  <option value="service">Услуга печати</option>
                </select>
              </label>
              {printType !== 'none' && (
                <NumField label="Количество цветов" value={colors} onChange={setColors} />
              )}
              {(printType === 'offset' || printType === 'service') && (
                <NumField label={printType === 'offset' ? 'Офсет, сум/лист (0=авто)' : 'Цена услуги, сум/короб.'} value={printRate} onChange={setPrintRate} money />
              )}
              {printType !== 'none' && <NumField label="Клише, сум" value={plateFee} onChange={setPlateFee} money />}
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-brand-gray-dark mb-1.5">Маршрут (выберите операции)</div>
              <div className="flex flex-wrap gap-1.5">
                {(settings?.operations ?? []).map((op) => {
                  const active = op.id === 'flexo' ? printType === 'flexo' : Boolean(activeOperations[op.id])
                  return (
                    <button
                      key={op.id}
                      type="button"
                      disabled={op.id === 'flexo'}
                      onClick={() => setActiveOperations({ ...activeOperations, [op.id]: !activeOperations[op.id] })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                        active
                          ? 'bg-brand-yellow-light border-brand-yellow text-brand-yellow-dark'
                          : 'bg-brand-gray border-brand-border text-brand-gray-dark'
                      }`}
                    >
                      {op.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Step 4: price & conditions */}
          <section className="border border-brand-border rounded-xl p-4 bg-white">
            <div className="text-sm font-semibold text-brand-ink mb-3">04 · Цена и условия</div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-brand-gray-dark">Расчёт цены</span>
                <select
                  value={pricingMode}
                  onChange={(e) => setPricingMode(e.target.value as CalculatorConfig['pricingMode'])}
                  className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                >
                  <option value="margin">По целевой марже</option>
                  <option value="manual">Цена вручную</option>
                </select>
              </label>
              {pricingMode === 'margin' ? (
                <NumField label="Целевая маржа, %" value={margin} onChange={setMargin} />
              ) : (
                <NumField label="Цена с НДС, сум/короб." value={manualPrice} onChange={setManualPrice} money />
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <NumField label="НДС, %" value={vat} onChange={setVat} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-brand-gray-dark">Округление</span>
                <select
                  value={rounding}
                  onChange={(e) => setRounding(Number(e.target.value))}
                  className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                >
                  <option value={0.01}>До 0.01</option>
                  <option value={1}>До 1</option>
                  <option value={10}>До 10</option>
                  <option value={100}>До 100</option>
                </select>
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <NumField label="Логистика, сум" value={logistics} onChange={setLogistics} money />
              <NumField label="Доставка, сум" value={deliveryCost} onChange={setDeliveryCost} money />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <NumField label="Срок, раб. дней" value={leadTime} onChange={setLeadTime} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-brand-gray-dark">Дата доставки</span>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-gray-dark">Заметки</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow resize-none"
              />
            </label>
          </section>
        </div>

        {/* Result panel */}
        <div className="bg-brand-black text-white rounded-2xl p-5 h-fit xl:sticky xl:top-32 print:static print:w-full print:text-black print:bg-white">
          {result ? (
            <>
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-white/45 mb-3 print:hidden">
                <span>{viewMode === 'sales' ? 'Коммерческое предложение' : 'Управленческий расчёт'}</span>
                <span>{formatDate(new Date().toISOString())}</span>
              </div>

              <div className="text-xs text-white/50 mb-1">Цена с НДС за коробку</div>
              <div className="text-4xl font-extrabold text-brand-yellow mb-1">{formatMoney(result.saleVat)}</div>
              <div className="text-xs text-white/50 mb-4">без НДС: {formatMoney(result.saleNoVat)}</div>

              {viewMode === 'management' ? (
                <>
                  <div className="grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden mb-4">
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Себестоимость 1 шт.</div>
                      <div className="text-sm font-semibold">{formatMoney(result.unitCost)}</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Прибыль 1 шт.</div>
                      <div className="text-sm font-semibold">{formatMoney(result.unitProfit)}</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Маржа</div>
                      <div className="text-sm font-semibold">{result.actualMargin.toFixed(2)}%</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Итого заказ</div>
                      <div className="text-sm font-semibold">{formatMoney(result.totalVat)}</div>
                    </div>
                  </div>

                  <div className="text-xs font-semibold mb-1.5">Структура себестоимости</div>
                  <div className="flex flex-col gap-1 text-xs text-white/70 mb-4">
                    <Row label="Материалы" value={result.materialOrderCost} />
                    <Row label="Клей" value={result.glueOrderCost} />
                    <Row label="Печать" value={result.printOrderCost} />
                    <Row label="Производство" value={result.productionOrderCost} />
                    <Row label="Накладные" value={result.overheadOrderCost} />
                    <Row label="Логистика" value={result.logisticsOrderCost} />
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden text-xs">
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Бумага</div>
                      <div>{formatNumber(result.paperWeight)} кг</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Клей</div>
                      <div>{formatNumber(result.glueWeight)} кг</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Листов</div>
                      <div>{formatNumber(result.sheetRun)}</div>
                    </div>
                    <div className="bg-black/40 p-3">
                      <div className="text-[10px] text-white/45">Время маршрута</div>
                      <div>{result.routeTime.toFixed(1)} ч</div>
                    </div>
                  </div>

                  <div className="mt-4 text-[10px] text-white/35 leading-relaxed print:hidden">
                    Сырьё спишется со склада только когда заказ перейдёт в статус «В работе» — сейчас это предварительный расчёт.
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 text-xs border-t border-white/10 pt-3">
                  <OfferLine label="Клиент" value={selectedClientName} />
                  <OfferLine label="Изделие" value={selectedProductName || 'Гофрокороб'} />
                  <OfferLine label="Формат" value={`${formatNumber(result.blank.w)} × ${formatNumber(result.blank.h)} мм`} />
                  <OfferLine label="Площадь 1 коробки" value={`${result.areaPerBox.toFixed(3)} м²`} />
                  <OfferLine label="Структура" value={boardSummary || '—'} />
                  <OfferLine label="Печать" value={printLabel} />
                  <OfferLine label="Тираж" value={`${formatNumber(result.quantity)} коробок`} />
                  <OfferLine label="Срок" value={`${leadTime} рабочих дней`} />
                  <p className="text-white/40 text-[10px] leading-relaxed mt-2">
                    Внутренняя себестоимость, нормы производства и маржа скрыты.
                  </p>
                </div>
              )}

              <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-between">
                <span className="text-[10px] text-white/50">Итого за заказ с НДС</span>
                <span className="text-lg font-bold text-white">{formatMoney(result.totalVat)}</span>
              </div>

              <button
                type="button"
                onClick={copyOffer}
                className="mt-3 w-full px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition print:hidden"
              >
                Копировать КП
              </button>
            </>
          ) : (
            <div className="text-sm text-white/60">Загрузка настроек калькулятора…</div>
          )}
        </div>
      </div>

      {openHistoryId && <PastTechCardPeek id={openHistoryId} onClose={() => setOpenHistoryId(null)} />}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  money,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  money?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-brand-gray-dark">{label}</span>
      {money ? (
        <MoneyInput
          value={value}
          onChange={onChange}
          className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
        />
      ) : (
        <input
          type="number"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
        />
      )}
    </label>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium text-white">{formatMoney(value)}</span>
    </div>
  )
}

function OfferLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  )
}

function PastTechCardPeek({ id, onClose }: { id: string; onClose: () => void }) {
  const [saleVat, setSaleVat] = useState<number | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('tech_cards')
      .select('sale_price_vat, created_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) {
          setSaleVat(Number(data.sale_price_vat))
          setCreatedAt(data.created_at)
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-brand-ink mb-2">Прошлый расчёт</div>
        {saleVat != null ? (
          <div className="text-sm text-brand-gray-dark">
            Дата: {createdAt ? formatDate(createdAt) : '—'}
            <br />
            Цена тогда: {formatMoney(saleVat)}/шт.
          </div>
        ) : (
          <div className="text-sm text-brand-gray-dark">Загрузка…</div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black hover:brightness-95 transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
