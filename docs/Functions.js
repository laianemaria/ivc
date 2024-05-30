function mapearValorParaCor(valor) {
    // Verifica se o valor é uma string e tenta convertê-lo para número
    if (typeof valor === 'string') {
        valor = valor.replace(',', '.'); // Substitui vírgula por ponto para formato decimal
        //valor = parseFloat(valor); // Converte a string para número
    }

    if (typeof valor === 'number' && !isNaN(valor)) {
        const limites = [0, 20, 40, 60, 80, 100];
        const cores = ["#FFFFFF", "#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6"];
        for (let i = 0; i < limites.length; i++) {
            if (valor <= limites[i]) {
                return cores[i];
            }
        }
        return cores[cores.length - 1];
    } else if (typeof valor === 'string') {
        switch (valor) {
            case "Possui":
            case "Sim":
                return "#ACD793";
            case "Não Possui":
            case "Não":
                return "#EE4E4E";
            case "Em elaboração":
                return "#FFC55A";
            case "-":
                return "#D3D3D3";
            default:
                return "#000000";
        }
    }
    return "#000000"; // Retorna preto como cor padrão para qualquer outro caso
}


function desenharMapa(idSvg, arquivoGeojson, arquivoCsv, campoConsulta) {
    var svg = d3.select(idSvg),
        width = +svg.attr("width"),
        height = +svg.attr("height");

    svg.selectAll("*").remove();

    svg.append("text")
        .attr("x", 0)
        .attr("y", height - 315)
        .attr("transform", "rotate(-90, 10," + height / 2 + ")")
        .style("text-anchor", "middle")
        .style("font-size", "20px")
        .text(campoConsulta);

    var projection = d3.geoMercator();
    var path = d3.geoPath().projection(projection);

    d3.json(arquivoGeojson).then(function (topo) {
        var codigosMunicipios = new Set(topo.features.map(function (d) {
            return d.properties.CD_MUN;
        }));

        d3.dsv(";", arquivoCsv, function (d) {
            if (d.Estado === "Pará" && codigosMunicipios.has(d['Código IBGE'])) {
                var valor = d[campoConsulta].replace(',', '.').trim();
                console.log(typeof d[campoConsulta]);
                valor = !isNaN(valor) ? parseFloat(valor) : valor;
                console.log(typeof valor);
                return {
                    codigo: d['Código IBGE'],
                    abastecimentoAgua: valor || "-"
                };
            }
        }).then(function (data) {
            var dataMap = new Map(data.map(d => [d.codigo, d.abastecimentoAgua]));
            var isNumeric = !isNaN(dataMap.values().next().value);

            projection.fitSize([width, height], topo);

            svg.selectAll("path")
                .data(topo.features)
                .enter()
                .append("path")
                .attr("d", path)
                .attr("fill", function (d) {
                    var valor = dataMap.get(d.properties['CD_MUN']) || "-";
                    return mapearValorParaCor(valor);
                })
                .attr("stroke", "#20202050")
                .on("mouseover", function (event, d) {
                    const nomeElemento  = idSvg.replace('#', '');
                    if (isNumeric){
                        document.getElementById(`Nome${nomeElemento }`).textContent = `${event.properties.NM_MUN} - ${dataMap.get(event.properties.CD_MUN)}%`;
                    } else {
                        document.getElementById(`Nome${nomeElemento }`).textContent = `${event.properties.NM_MUN} - ${dataMap.get(event.properties.CD_MUN)}`;
                    }

                    
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .style("opacity", 0.25)
                        .style("stroke", "#20202050");
                })
                .on("mouseleave", function (d) {
                    const nomeElemento  = idSvg.replace('#', 'Nome');
                    document.getElementById(`${nomeElemento }`).textContent = '';
                    d3.selectAll("path")
                        .transition()
                        .duration(200)
                        .style("opacity", 1)
                        .style("stroke", "#20202050");
                });

            // Cria a legenda ou barra de cores dependendo do tipo de dados
            if (isNumeric) {
                var coresLegenda = [
                    {cor: mapearValorParaCor("-"), texto: "Sem dados" },
                    {cor: mapearValorParaCor(0), texto: "0%"},
                    {cor: mapearValorParaCor(25), texto: "25%"},
                    {cor: mapearValorParaCor(50), texto: "50%"},
                    {cor: mapearValorParaCor(75), texto: "75%"},
                    {cor: mapearValorParaCor(100), texto: "100%"},
                ];
            } else {
                var coresLegenda = [
                    { cor: mapearValorParaCor("Sim"), texto: "Sim" },
                    { cor: mapearValorParaCor("Não"), texto: "Não" },
                    { cor: mapearValorParaCor("Em elaboração"), texto: "Em elaboração" },
                    { cor: mapearValorParaCor("-"), texto: "Sem dados" },
                ];
            }
                // Cria a legenda categórica para dados não numéricos
                var legenda = svg.append("g")
                    .attr("id", "legenda")
                    .attr("transform", "translate(550,500)");

                var itensLegenda = legenda.selectAll("g.itemLegenda")
                    .data(coresLegenda)
                    .enter()
                    .append("g")
                    .attr("class", "itemLegenda")
                    .attr("transform", function (d, i) { return "translate(0," + i * 25 + ")"; });

                itensLegenda.append("rect")
                    .attr("width", 20)
                    .attr("height", 20)
                    .attr("fill", function (d) { return d.cor; });

                itensLegenda.append("text")
                    .attr("x", 30)
                    .attr("y", 15)
                    .text(function (d) { return d.texto; });
            
        });
    });
}

function popularCardComSelects() {
    var basesDados = {
        "Instituto Água e Saneamento": [
            "Possui Conselho Municipal de Saneamento",
            "Possui Fundo Municipal de Saneamento Básico",
            "Possui Política Municipal de Saneamento Básico",
            "Possui Plano Municipal de Saneamento Básico",
            "O plano possui ações para emergências e contingências",
            "Possui Coleta Seletiva de Resíduos Sólidos",
            "Existe mapeamento de áreas de risco de inundação dos cursos d'água urbanos",
            "Existem sistemas de alerta de riscos hidrológicos (alagamentos, enxurradas, inundações)",
            "Participa de comitê de bacia ou sub-bacia organizado",
            "Percentual de População Urbana",
            "Percentual de População Rural",
            "Índice da População Total Atendida com Abastecimento de Água (%)",
            "Índice da População Urbana Atendida com Abastecimento de Água (%)",
            "Índice da População Rural Atendida com Abastecimento de Água (%)",
            "Índice da População Rural Atendida com Esgotamento Sanitário (%)",
            "Índice de Atendimento com Coleta e com Tratamento de Esgoto (%)",
            "Parcela de Domicílios com Risco de Inundação",
            "Parcela da população com Risco de Eventos Hidrológicos",
            


        ],
    };

    var card = document.getElementById('optCard');

    var cardHeader = document.createElement('div');
    cardHeader.className = 'card-header bg-light text-black h4';
    cardHeader.textContent = 'Opções';

    var cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    var row = document.createElement('div');
    row.className = 'row row-col-3';

    // Cria o select de base de dados
    var colBaseDados = document.createElement('div');
    colBaseDados.className = 'col';

    var labelBaseDados = document.createElement('label');
    labelBaseDados.setAttribute('for', 'inputDataBase');
    labelBaseDados.className = 'form-label';
    labelBaseDados.textContent = '1 - Escolha uma Base de Dados*';

    var selectBaseDados = document.createElement('select');
    selectBaseDados.id = 'inputDataBase';
    selectBaseDados.className = 'form-select form-select-lg';
    selectBaseDados.innerHTML = '<option value="Selecione" selected>Selecione</option>';

    // Preenche o select de base de dados
    Object.keys(basesDados).forEach(function (base) {
        var option = document.createElement('option');
        option.value = base;
        option.textContent = base;
        selectBaseDados.appendChild(option);
    });

    var smallBaseDados = document.createElement('small');
    smallBaseDados.textContent = '*Outras em Breve';

    // Cria o select de indicadores
    var colIndicador = document.createElement('div');
    colIndicador.className = 'col';

    var labelIndicador = document.createElement('label');
    labelIndicador.setAttribute('for', 'inputIndicador');
    labelIndicador.className = 'form-label';
    labelIndicador.textContent = '2 - Escolha um Indicador*';

    var selectIndicador = document.createElement('select');
    selectIndicador.id = 'inputIndicador';
    selectIndicador.className = 'form-select form-select-lg';
    selectIndicador.innerHTML = '<option value="Selecione" selected>Selecione</option>';

    var smallIndicador = document.createElement('small');
    smallIndicador.textContent = '*Outras em Breve';

    var colBotao = document.createElement('div');
    colBotao.className = 'col d-flex justify-content-start';

    // Cria o botão de visualização de dados
    var botaoVisualizar = document.createElement('button');
    botaoVisualizar.type = 'button';
    botaoVisualizar.id = 'btnConsultar';
    botaoVisualizar.className = 'btn btn-dark btn-lg';
    botaoVisualizar.textContent = 'Visualizar dados';

    // Monta a estrutura do card
    colBaseDados.appendChild(labelBaseDados);
    colBaseDados.appendChild(selectBaseDados);
    colBaseDados.appendChild(smallBaseDados);

    colIndicador.appendChild(labelIndicador);
    colIndicador.appendChild(selectIndicador);
    colIndicador.appendChild(smallIndicador);

    colBotao.appendChild(botaoVisualizar);

    row.appendChild(colBaseDados);
    row.appendChild(colIndicador);
    row.appendChild(colBotao);

    cardBody.appendChild(row);

    card.appendChild(cardHeader);
    card.appendChild(cardBody);

    // Função para atualizar os indicadores com base na base de dados selecionada
    selectBaseDados.onchange = function () {
        var baseSelecionada = this.value;
        if (baseSelecionada === 'Selecione') {
            selectIndicador.innerHTML = '<option value="Selecione" selected>Selecione</option>';
            selectIndicador.disabled = true; // Desabilita o segundo select
        } else {
            selectIndicador.disabled = false; // Habilita o segundo select
            var indicadores = basesDados[baseSelecionada] || [];
            selectIndicador.innerHTML = '<option value="Selecione" selected>Selecione</option>';
            indicadores.forEach(function (indicador) {
                var option = document.createElement('option');
                option.value = indicador;
                option.textContent = indicador;
                selectIndicador.appendChild(option);
            });
        }
    };

    // Inicialmente desabilita o segundo select
    selectIndicador.disabled = true;
}