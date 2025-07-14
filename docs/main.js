document.addEventListener('DOMContentLoaded', () => {

    // --- ESTRUTURA DE DADOS E CONSTANTES ---
    const regioesEEstados = { "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"], "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"], "Centro-Oeste": ["DF", "GO", "MT", "MS"], "Sudeste": ["ES", "MG", "RJ", "SP"], "Sul": ["PR", "SC", "RS"] };
    const PATH_MUNICIPIOS_GEOJSON = "states/"; 
    const URL_ESTADOS = "https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/master/uf/geojson/uf.json";
    const dataSources = { 
        "Instituto Água e Saneamento": "municipiose_saneamento_export_14_07_2025.csv",
        "IBGE População Quilombola": "e2852dc6-404c-4a54-95b2-a5bc8ef84c1a.csv",
    };
    
    const coastalZones = {
        'AP': ['Amapá', 'Calçoene', 'Oiapoque'],
        'PA': ['Augusto Corrêa', 'Bragança', 'Chaves', 'Curuçá', 'Maracanã', 'Marapanim', 'Quatipuru', 'Salinópolis', 'Soure', 'São Caetano de Odivelas', 'São João de Pirabas', 'São Sebastião da Boa Vista', 'Tracuateua', 'Viseu', 'Belém'],
        'MA': ['Alcântara', 'São Luís', 'Raposa', 'São José de Ribamar', 'Paço do Lumiar'],
        'PI': ['Cajueiro da Praia', 'Ilha Grande', 'Luís Correia', 'Parnaíba'],
        'CE': ['Fortaleza', 'Aquiraz', 'Caucaia', 'Jijoca de Jericoacoara', 'Aracati', 'Icapuí'],
        'RN': ['Natal', 'Extremoz', 'Maxaranguape', 'Tibau do Sul', 'Galinhos'],
        'PB': ['João Pessoa', 'Cabedelo', 'Conde', 'Lucena'],
        'PE': ['Recife', 'Olinda', 'Jaboatão dos Guararapes', 'Ipojuca', 'Cabo de Santo Agostinho'],
        'AL': ['Maceió', 'Maragogi', 'Barra de São Miguel', 'Japaratinga'],
        'SE': ['Aracaju', 'Estância', 'Itaporanga d\'Ajuda', 'Barra dos Coqueiros'],
        'BA': ['Salvador', 'Porto Seguro', 'Ilhéus', 'Cairu', 'Itacaré'],
        'ES': ['Vitória', 'Vila Velha', 'Guarapari', 'Anchieta', 'Conceição da Barra'],
        'RJ': ['Rio de Janeiro', 'Niterói', 'Armação dos Búzios', 'Angra dos Reis', 'Cabo Frio', 'Paraty'],
        'SP': ['Santos', 'Guarujá', 'Ubatuba', 'São Sebastião', 'Ilhabela', 'Caraguatatuba'],
        'PR': ['Paranaguá', 'Matinhos', 'Guaratuba', 'Pontal do Paraná'],
        'SC': ['Florianópolis', 'Balneário Camboriú', 'Bombinhas', 'Itajaí', 'Laguna'],
        'RS': ['Rio Grande', 'Torres', 'Capão da Canoa', 'Tramandaí']
    };

    const indicatorTypes = {
        'População': 'population',
        'População sem Água': 'percentage',
        'População sem Esgoto': 'percentage',
        'População sem coleta de lixo': 'percentage',
        'Domicílios sujeitos à inundações': 'percentage',
        'Possui Plano Municipal': 'categorical'
    };

    // --- REFERÊNCIAS DO DOM ---
    const selectRegiao = document.getElementById('filter-region'), selectEstado = document.getElementById('filter-state'), selectDataSource = document.getElementById('filter-datasource'), selectIndicator = document.getElementById('filter-indicator'), btnAplicarFiltros = document.getElementById('btn-apply-filters'), btnVoltar = document.getElementById('btn-back-to-brazil'), mapTitle = document.getElementById('map-title'), mapHoverInfo = document.getElementById('map-hover-info'), loader = document.getElementById('loader'), svgMap = d3.select("#map-visualization"), mapContainer = document.querySelector('.map-container'), btnDownloadMap = document.getElementById('btn-download-map'), chartCard = document.getElementById('chart-card'), svgSecondary = d3.select("#secondary-visualization"), chartContainer = document.querySelector('.chart-container'), chartTitle = document.getElementById('chart-title'), btnDownloadChart = document.getElementById('btn-download-chart'), chartTypeSelector = document.getElementById('chart-type-selector'), btnSpikeMap = document.getElementById('btn-spike-map'), btnBubbleMap = document.getElementById('btn-bubble-map'),
    filterCoastalZone = document.getElementById('filter-coastal-zone'), labelCoastalZone = document.getElementById('label-coastal-zone');
    
    // --- VARIÁVEIS DE ESTADO ---
    const projection = d3.geoMercator();
    let isRendering = false;
    let populationChartType = 'bubble';
    let lastRenderArgs = {};
    let currentView = 'brazil';

    // --- FUNÇÕES DE INICIALIZAÇÃO E EVENTOS ---
    function init() {
        populateRegionFilter();
        populateDataSourceFilter();
        selectRegiao.addEventListener('change', updateStateFilter);
        selectDataSource.addEventListener('change', updateIndicatorFilter);
        selectEstado.addEventListener('change', () => {
            updateButtonState();
            toggleCoastalFilter();
        });
        selectIndicator.addEventListener('change', updateButtonState);
        btnAplicarFiltros.addEventListener('click', applyFilters);
        btnVoltar.addEventListener('click', () => { if (!isRendering) renderStates(); });
        btnDownloadMap.addEventListener('click', () => downloadSVG("map-visualization", `mapa_${mapTitle.textContent.replace(/[ /]/g, '_')}.png`));
        btnDownloadChart.addEventListener('click', () => downloadSVG("secondary-visualization", `grafico_${chartTitle.textContent.replace(/[ /]/g, '_')}.png`));
        btnSpikeMap.addEventListener('click', () => setPopulationChartType('spike'));
        btnBubbleMap.addEventListener('click', () => setPopulationChartType('bubble'));
        window.addEventListener('resize', debounce(handleResize, 250));
        updateButtonState();
        renderStates();
    }
    
    function populateRegionFilter() {
        selectRegiao.innerHTML = '<option value="todos">Todas as Regiões</option>';
        for (const regiao in regioesEEstados) { selectRegiao.add(new Option(regiao, regiao)); }
    }
    
    function populateDataSourceFilter() {
        selectDataSource.innerHTML = '<option value="">Selecione uma Fonte</option>';
        for (const source in dataSources) { selectDataSource.add(new Option(source, source)); }
    }

    function updateStateFilter() {
        const regiao = selectRegiao.value;
        selectEstado.innerHTML = '<option value="todos">Todos os Estados</option>';
        selectEstado.disabled = true;
        if (regiao !== 'todos' && regioesEEstados[regiao]) {
            selectEstado.disabled = false;
            regioesEEstados[regiao].forEach(uf => selectEstado.add(new Option(uf, uf)));
        }
        updateButtonState();
        toggleCoastalFilter();
    }
    
    async function updateIndicatorFilter() {
        const sourceName = selectDataSource.value;
        selectIndicator.innerHTML = '<option value="">Selecione um Indicador</option>';
        selectIndicator.disabled = true;
        updateButtonState();
        if (sourceName && dataSources[sourceName]) {
            const csvPath = dataSources[sourceName];
            setLoading(true);
            mapHoverInfo.textContent = `Lendo indicadores...`;
            try {
                const data = await d3.dsv(";", csvPath);
                const nonIndicatorColumns = new Set(['Cidade', 'UF']);
                const indicators = data.columns.filter(header => !nonIndicatorColumns.has(header) && header);
                selectIndicator.disabled = false;
                indicators.forEach(indicator => {
                    const formattedText = (indicator.charAt(0).toUpperCase() + indicator.slice(1)).replace(/_/g, ' ');
                    selectIndicator.add(new Option(formattedText, indicator));
                });
            } catch (error) { console.error("Erro ao carregar CSV:", error); }
            finally { setLoading(false); mapHoverInfo.textContent = '\u00A0'; }
        }
    }

    function updateButtonState() {
        const stateSelected = selectEstado.value !== 'todos';
        const indicatorSelected = selectIndicator.value !== '';
        btnAplicarFiltros.disabled = !(stateSelected && indicatorSelected);
    }
    
    function applyFilters() {
        if (isRendering) return;
        const estado = selectEstado.value;
        const indicador = selectIndicator.value;
        const sourceName = selectDataSource.value;
        const csvPath = dataSources[sourceName];
        const coastalOnly = filterCoastalZone.checked;

        if (estado !== 'todos' && indicador && csvPath) {
            renderMunicipios(estado, indicador, csvPath, coastalOnly);
        } else {
            alert("Por favor, selecione um Estado e um Indicador para visualizar.");
        }
    }

    function setPopulationChartType(type) {
        populationChartType = type;
        if (lastRenderArgs.geojson) {
            drawSecondaryVisualization(lastRenderArgs.geojson, lastRenderArgs.dataMap, lastRenderArgs.indicador, lastRenderArgs.estado, lastRenderArgs.tipo, lastRenderArgs.coastalOnly);
        }
    }

    function toggleCoastalFilter() {
        const selectedState = selectEstado.value;
        if (coastalZones.hasOwnProperty(selectedState)) {
            filterCoastalZone.disabled = false;
            labelCoastalZone.classList.remove('text-gray-500');
            labelCoastalZone.classList.add('text-gray-700');
        } else {
            filterCoastalZone.disabled = true;
            filterCoastalZone.checked = false;
            labelCoastalZone.classList.add('text-gray-500');
            labelCoastalZone.classList.remove('text-gray-700');
        }
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function handleResize() {
        if (isRendering) return;
        if (currentView === 'brazil') {
            renderStates(selectRegiao.value);
        } else if (currentView === 'state' && lastRenderArgs.geojson) {
            renderMunicipios(lastRenderArgs.estado, lastRenderArgs.indicador, dataSources[selectDataSource.value], lastRenderArgs.coastalOnly);
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function setLoading(isLoading) { isRendering = isLoading; loader.classList.toggle('hidden', !isLoading); svgMap.classed('hidden', isLoading); }

    function renderStates(regiaoFiltro = null) {
        currentView = 'brazil';
        setLoading(true);
        chartCard.classList.add('hidden');
        mapTitle.textContent = "Mapa do Brasil";
        btnVoltar.classList.add('hidden');
        svgMap.selectAll("*").remove();
        
        const width = mapContainer.clientWidth, height = mapContainer.clientHeight;
        svgMap.attr("width", width).attr("height", height);

        d3.json(URL_ESTADOS).then(geojson => {
            let geojsonFiltrado = geojson;
            if (regiaoFiltro && regiaoFiltro !== 'todos') {
                geojsonFiltrado = { ...geojson, features: geojson.features.filter(f => regioesEEstados[regiaoFiltro].includes(f.properties.sigla)) };
                mapTitle.textContent = `Região ${regiaoFiltro}`;
            }
            projection.fitSize([width, height], geojsonFiltrado);
            const pathGenerator = d3.geoPath().projection(projection);

            svgMap.append("g").selectAll("path").data(geojson.features).enter().append("path")
                .attr("d", pathGenerator).attr("class", "estado")
                .attr("fill", d => (regiaoFiltro && regiaoFiltro !== 'todos') ? (regioesEEstados[regiaoFiltro].includes(d.properties.sigla) ? "#a5b4fc" : "#e5e7eb") : "#c7d2fe")
                .attr("stroke", "#ffffff").attr("stroke-width", 1).style("cursor", "pointer")
                .on("mouseover", function (d) { if (isRendering) return; d3.select(this).style("fill", "#6366f1"); mapHoverInfo.textContent = d.properties.nome; })
                .on("mouseleave", function (d) { if (isRendering) return; d3.select(this).style("fill", (regiaoFiltro && regiaoFiltro !== 'todos') ? (regioesEEstados[regiaoFiltro].includes(d.properties.sigla) ? "#a5b4fc" : "#e5e7eb") : "#c7d2fe"); mapHoverInfo.textContent = '\u00A0'; })
                .on("click", d => {
                    if (isRendering) return;
                    selectEstado.value = d.properties.sigla;
                    toggleCoastalFilter();
                    updateButtonState();
                    const indicator = selectIndicator.value;
                    const csvPath = dataSources[selectDataSource.value];
                    if (indicator && csvPath) { renderMunicipios(d.properties.sigla, indicator, csvPath, filterCoastalZone.checked); }
                });
            setLoading(false);
        }).catch(error => { console.error("Erro ao carregar GeoJSON dos estados:", error); setLoading(false); });
    }
    
    function renderMunicipios(siglaUF, indicador, csvPath, coastalOnly) {
        currentView = 'state';
        setLoading(true);
        btnVoltar.classList.remove('hidden');
        const urlGeojson = `${PATH_MUNICIPIOS_GEOJSON}${siglaUF}.geojson`;
        Promise.all([d3.json(urlGeojson), d3.dsv(";", csvPath)]).then(([geojson, csvData]) => {
            const indicatorType = indicatorTypes[indicador] || 'integer';
            const dataMap = new Map(csvData.filter(d => normalizeText(d.UF) === normalizeText(siglaUF)).map(d => [normalizeText(d.Cidade) + '-' + normalizeText(d.UF), d[indicador]]));
            lastRenderArgs = { geojson, dataMap, indicador, estado: siglaUF, tipo: indicatorType, coastalOnly };
            renderChoroplethMap(geojson, dataMap, indicador, siglaUF, indicatorType, coastalOnly);
            drawSecondaryVisualization(geojson, dataMap, indicador, siglaUF, indicatorType, coastalOnly);
            chartCard.classList.remove('hidden');
            setLoading(false);
        }).catch(error => { console.error(`Erro ao carregar dados:`, error); setLoading(false); });
    }

    function renderChoroplethMap(geojson, dataMap, indicador, siglaUF, indicatorType, coastalOnly) {
        const width = mapContainer.clientWidth, height = mapContainer.clientHeight;
        svgMap.attr("width", width).attr("height", height);
        const indicadorCapitalized = (indicador.charAt(0).toUpperCase() + indicador.slice(1)).replace(/_/g, ' ');
        mapTitle.textContent = `${indicadorCapitalized} em ${siglaUF}`;
        svgMap.selectAll("*").remove();
        projection.fitSize([width, height], geojson);
        const pathGenerator = d3.geoPath().projection(projection);
        svgMap.append("g").selectAll("path").data(geojson.features).enter().append("path")
            .attr("d", pathGenerator)
            .attr("fill", d => {
                const isCoastal = coastalZones[siglaUF]?.map(c => normalizeText(c)).includes(normalizeText(d.properties.NM_MUN));
                if (coastalOnly && !isCoastal) return '#f0f0f0';
                const key = normalizeText(d.properties.NM_MUN) + '-' + normalizeText(siglaUF);
                return mapColor(dataMap.get(key), indicatorType, Array.from(dataMap.values()));
            })
            .attr("stroke", d => {
                const isCoastal = coastalZones[siglaUF]?.map(c => normalizeText(c)).includes(normalizeText(d.properties.NM_MUN));
                return (coastalOnly && !isCoastal) ? '#d9d9d9' : '#ffffff';
            })
            .attr("stroke-width", 0.5)
            .on("mouseover", function(d) {
                const valor = dataMap.get(normalizeText(d.properties.NM_MUN) + '-' + normalizeText(siglaUF)) || "N/D";
                mapHoverInfo.textContent = `${d.properties.NM_MUN}: ${valor}`;
            }).on("mouseleave", () => mapHoverInfo.textContent = '\u00A0');
        createLegend(svgMap, dataMap, indicatorType, indicadorCapitalized);
    }
    
    function drawSecondaryVisualization(geojson, dataMap, indicator, state, type, coastalOnly) {
        const width = chartContainer.clientWidth, height = chartContainer.clientHeight;
        svgSecondary.attr("width", width).attr("height", height);
        svgSecondary.selectAll("*").remove();
        chartTypeSelector.classList.toggle('hidden', type !== 'population');

        btnSpikeMap.classList.toggle('bg-indigo-500', populationChartType === 'spike');
        btnSpikeMap.classList.toggle('text-white', populationChartType === 'spike');
        btnSpikeMap.classList.toggle('bg-gray-200', populationChartType !== 'spike');
        btnBubbleMap.classList.toggle('bg-indigo-500', populationChartType === 'bubble');
        btnBubbleMap.classList.toggle('text-white', populationChartType === 'bubble');
        btnBubbleMap.classList.toggle('bg-gray-200', populationChartType !== 'bubble');
        
        if (type === 'population') {
            const secondaryProjection = d3.geoMercator().fitSize([width, height], geojson);
            if (populationChartType === 'spike') { drawSpikeMap(svgSecondary, geojson, dataMap, state, secondaryProjection, coastalOnly); }
            else { drawBubbleMap(svgSecondary, geojson, dataMap, state, secondaryProjection, coastalOnly); }
        } else {
            drawBarChart(svgSecondary, Array.from(dataMap), indicator, state, type, coastalOnly);
        }
    }
    
    function drawSpikeMap(svg, geojson, dataMap, state, projection, coastalOnly) {
        chartTitle.textContent = `Spike Map - População em ${state}`;
        const path = d3.geoPath().projection(projection);
        svg.append("g").selectAll("path").data(geojson.features).enter().append("path").attr("d", path).attr("class", "map-base");
        const populationData = Array.from(dataMap.values()).map(v => parseFloat(String(v).replace(',', '.')) || 0);
        const spikeScale = d3.scaleLinear().domain([0, d3.max(populationData)]).range([0, 100]);
        svg.append("g").selectAll(".spike").data(geojson.features).enter().append("line")
            .attr("class", "spike")
            .attr("x1", d => projection(d3.geoCentroid(d))[0]).attr("y1", d => projection(d3.geoCentroid(d))[1])
            .attr("x2", d => projection(d3.geoCentroid(d))[0]).attr("y2", d => {
                const isCoastal = coastalZones[state]?.map(c => normalizeText(c)).includes(normalizeText(d.properties.NM_MUN));
                if (coastalOnly && !isCoastal) return projection(d3.geoCentroid(d))[1];
                const pop = parseFloat(String(dataMap.get(normalizeText(d.properties.NM_MUN) + '-' + normalizeText(state))).replace(',', '.')) || 0;
                return projection(d3.geoCentroid(d))[1] - spikeScale(pop);
            });
        createProportionalSymbolLegend(svg, spikeScale, "População (Spikes)");
    }

    function drawBubbleMap(svg, geojson, dataMap, state, projection, coastalOnly) {
        chartTitle.textContent = `Bubble Map - População em ${state}`;
        const path = d3.geoPath().projection(projection);
        svg.append("g").selectAll("path").data(geojson.features).enter().append("path").attr("d", path).attr("class", "map-base");
        const populationData = Array.from(dataMap.values()).map(v => parseFloat(String(v).replace(',', '.')) || 0);
        const radiusScale = d3.scaleSqrt().domain([0, d3.max(populationData)]).range([1, 40]);
        svg.append("g").selectAll(".bubble").data(geojson.features).enter().append("circle")
            .attr("class", "bubble")
            .attr("cx", d => projection(d3.geoCentroid(d))[0]).attr("cy", d => projection(d3.geoCentroid(d))[1])
            .attr("r", d => {
                const isCoastal = coastalZones[state]?.map(c => normalizeText(c)).includes(normalizeText(d.properties.NM_MUN));
                if (coastalOnly && !isCoastal) return 0;
                const pop = parseFloat(String(dataMap.get(normalizeText(d.properties.NM_MUN) + '-' + normalizeText(state))).replace(',', '.')) || 0;
                return radiusScale(pop);
            });
        createProportionalSymbolLegend(svg, radiusScale, "População (Bubbles)");
    }

    function drawBarChart(svg, data, indicator, state, type, coastalOnly) {
        const indicadorCapitalized = (indicator.charAt(0).toUpperCase() + indicator.slice(1)).replace(/_/g, ' ');
        const margin = {top: 20, right: 30, bottom: 150, left: 80};
        const width = chartContainer.clientWidth - margin.left - margin.right;
        const height = chartContainer.clientHeight - margin.top - margin.bottom;
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        let filteredData = data;
        if (coastalOnly) {
            const coastalCities = coastalZones[state]?.map(c => normalizeText(c));
            if(coastalCities) {
                filteredData = data.filter(([key, value]) => coastalCities.includes(key.split('-')[0]));
            }
        }
        
        if (type === 'categorical') {
            chartTitle.textContent = `Contagem - ${indicadorCapitalized} em ${state}`;
            const counts = d3.nest().key(d => d[1] || "Não informado").rollup(v => v.length).entries(filteredData);
            const x = d3.scaleBand().range([0, width]).padding(0.1).domain(counts.map(d => d.key));
            const y = d3.scaleLinear().range([height, 0]).domain([0, d3.max(counts, d => d.value)]);
            g.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
            g.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(Math.min(10, d3.max(counts, d => d.value) || 1)));
            g.selectAll(".bar").data(counts).enter().append("rect").attr("class", "bar").attr("x", d => x(d.key)).attr("y", d => y(d.value)).attr("width", x.bandwidth()).attr("height", d => height - y(d.value)).attr("fill", d => mapColor(d.key, 'categorical'));
        } else {
            chartTitle.textContent = `Top 10 - ${indicadorCapitalized} em ${state}`;
            const numericData = filteredData.map(([key, value]) => ({ nome: key.split('-')[0].replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()), valor: parseFloat(String(value).replace(',', '.')) || 0 })).filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 10);
            if (numericData.length === 0) { g.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("Nenhum dado para exibir."); return; }
            const x = d3.scaleBand().range([0, width]).padding(0.1).domain(numericData.map(d => d.nome));
            const y = d3.scaleLinear().range([height, 0]).domain([0, d3.max(numericData, d => d.valor)]);
            g.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-65)");
            g.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(10).tickFormat(d3.format(".2s")));
            g.selectAll(".bar").data(numericData).enter().append("rect").attr("class", "bar").attr("x", d => x(d.nome)).attr("y", d => y(d.valor)).attr("width", x.bandwidth()).attr("height", d => height - y(d.valor)).attr("fill", "#6366f1");
        }
    }

    function normalizeText(str) { return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : ""; }

    function mapColor(value, type, allValues) {
        if (value === undefined || value === null || value === "") return "#e5e7eb";
        let numericValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        if (isNaN(numericValue)) {
            const lowerCaseValue = String(value).trim().toLowerCase();
            if (type === 'categorical') {
                if (lowerCaseValue === "sim" || lowerCaseValue === "possui") return "#22c55e";
                if (lowerCaseValue === "não" || lowerCaseValue === "nao" || lowerCaseValue === "não possui") return "#ef4444";
            }
            return "#e5e7eb";
        }
        const numericDomain = allValues.map(v => parseFloat(String(v).replace(',', '.'))).filter(v => !isNaN(v));
        switch (type) {
            case 'percentage': return d3.scaleQuantize().domain([0, 100]).range(d3.schemeReds[7])(numericValue);
            case 'integer': case 'population':
                if (numericDomain.length === 0) return "#e5e7eb";
                return d3.scaleQuantile().domain(numericDomain).range(d3.schemeBlues[7])(numericValue);
            default: return "#e5e7eb";
        }
    }

    function createLegend(svg, dataMap, type, indicatorName) {
        const height = svg.node().clientHeight;
        svg.select(".legend").remove();
        const allValues = [...dataMap.values()].filter(v => v !== undefined && v !== null && v !== "");
        if (allValues.length === 0) return;
        const legendData = [];
        if (type === 'categorical') {
            [...new Set(allValues)].forEach(val => { if (val) legendData.push({ color: mapColor(val, type), text: val }); });
        } else {
            const numericValues = allValues.map(v => parseFloat(String(v).replace(',', '.'))).filter(v => !isNaN(v));
            if (numericValues.length === 0) return;
            const colorScale = (type === 'percentage') 
                ? d3.scaleQuantize().domain([0, 100]).range(d3.schemeReds[7])
                : d3.scaleQuantile().domain(numericValues).range(d3.schemeBlues[7]);
            
            colorScale.range().forEach(color => {
                const extent = colorScale.invertExtent(color);
                const text = `${d3.format(".2s")(extent[0])} - ${d3.format(".2s")(extent[1])}`;
                legendData.push({ color: color, text: text });
            });
        }
        const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(30, ${height - (legendData.length * 25) - 40})`);
        legend.append("text").attr("class", "legend-title").attr("x", 0).attr("y", -10).text(indicatorName);
        legend.selectAll("g").data(legendData).enter().append("g").attr("transform", (d, i) => `translate(0, ${i * 25})`).each(function(d) {
            d3.select(this).append("rect").attr("width", 20).attr("height", 20).attr("fill", d.color).attr("stroke", "#333").attr("stroke-width", 0.5);
            d3.select(this).append("text").attr("class", "legend-text").attr("x", 30).attr("y", 10).attr("alignment-baseline", "middle").text(d.text);
        });
    }

    function createProportionalSymbolLegend(svg, scale, title) {
        svg.select(".proportional-legend").remove();
        const width = svg.node().clientWidth;
        const legend = svg.append("g").attr("class", "proportional-legend").attr("transform", `translate(${width - 120}, 40)`);
        legend.append("text").attr("class", "legend-title").attr("y", -10).text(title);
        const legendValues = scale.ticks(4).filter(d => d > 0).reverse();
        const legendItems = legend.selectAll("g.legend-item").data(legendValues).enter().append("g").attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 60 + 50})`);

        if (title.includes("Bubble")) {
            legendItems.append("circle").attr("r", d => scale(d)).attr("class", "bubble").attr("cy", d => -scale(d));
            legendItems.append("text").attr("class", "legend-text").attr("x", 45).attr("y", d => -2 * scale(d) + 4).text(d => d3.format(".2s")(d));
        } else {
            legendItems.append("line").attr("class", "spike").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", d => -scale(d));
            legendItems.append("text").attr("class", "legend-text").attr("x", 10).attr("y", d => -scale(d) / 2).text(d => d3.format(".2s")(d));
        }
    }

    function downloadSVG(svgId, fileName) {
        const svgEl = document.getElementById(svgId);
        const scale = 2;
        const { width, height } = svgEl.getBoundingClientRect();
        if (width === 0 || height === 0) { console.error("Elemento SVG sem dimensões para baixar."); return; }
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const canvas = document.createElement("canvas");
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const ctx = canvas.getContext("2d");
        const svgString = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, scaledWidth, scaledHeight);
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            URL.revokeObjectURL(url);
            const pngUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.onerror = () => { console.error("A imagem SVG não pôde ser carregada para o canvas."); URL.revokeObjectURL(url); };
        img.src = url;
    }

    // --- EXECUÇÃO INICIAL ---
    init();
});