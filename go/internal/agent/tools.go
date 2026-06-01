package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
)

// BuildTools returns the tool definitions for OpenAI function calling.
func BuildTools(agenteID uuid.UUID) []ToolDef {
	return []ToolDef{
		{
			Type: "function",
			Function: Function{
				Name:        "consultar_preco",
				Description: "Consulta o preço de venda e locação de um produto pelo nome ou SKU.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"produto": map[string]any{
							"type":        "string",
							"description": "Nome, SKU ou descrição do produto a consultar",
						},
					},
					"required": []string{"produto"},
				},
			},
		},
		{
			Type: "function",
			Function: Function{
				Name:        "consultar_estoque",
				Description: "Consulta a quantidade em estoque e disponibilidade de um produto.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"produto": map[string]any{
							"type":        "string",
							"description": "Nome, SKU ou descrição do produto a consultar",
						},
					},
					"required": []string{"produto"},
				},
			},
		},
		{
			Type: "function",
			Function: Function{
				Name:        "transferir_setor",
				Description: "Transfere o atendimento para outro setor/loja (vendas ou locação). Use quando o cliente falar de um assunto que não é do setor atual.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"setor": map[string]any{
							"type":        "string",
							"description": "Setor de destino: 'vendas' ou 'locacao'",
							"enum":        []string{"vendas", "locacao"},
						},
					},
					"required": []string{"setor"},
				},
			},
		},
	}
}

// ExecuteTool runs a tool by name with JSON arguments and returns a JSON string result.
func ExecuteTool(ctx context.Context, name string, argsJSON string) (string, error) {
	switch name {
	case "consultar_preco":
		return consultarPreco(ctx, argsJSON)
	case "consultar_estoque":
		return consultarEstoque(ctx, argsJSON)
	case "transferir_setor":
		return transferirSetor(ctx, argsJSON)
	default:
		return "", fmt.Errorf("tool unknown: %s", name)
	}
}

type toolArgs struct {
	Produto string `json:"produto"`
	Setor   string `json:"setor"`
}

func consultarPreco(ctx context.Context, argsJSON string) (string, error) {
	var args toolArgs
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return "", fmt.Errorf("invalid args: %w", err)
	}
	term := "%" + strings.ToLower(args.Produto) + "%"
	rows, err := db.Pool.Query(ctx, `
		SELECT p.sku, p.nome, p.descricao, p.categoria, p.preco_venda, p.preco_locacao_dia, e.quantidade
		FROM produtos p
		LEFT JOIN estoque e ON e.produto_id = p.id
		WHERE lower(p.nome) LIKE $1 OR lower(p.sku) LIKE $1 OR lower(p.descricao) LIKE $1
		LIMIT 5
	`, term)
	if err != nil {
		return "", fmt.Errorf("query preco: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var sku, nome, descricao, categoria string
		var precoVenda, precoLocacao *float64
		var quantidade *int
		if err := rows.Scan(&sku, &nome, &descricao, &categoria, &precoVenda, &precoLocacao, &quantidade); err != nil {
			continue
		}
		results = append(results, map[string]any{
			"sku":               sku,
			"nome":              nome,
			"descricao":         descricao,
			"categoria":         categoria,
			"preco_venda":       precoVenda,
			"preco_locacao_dia": precoLocacao,
			"quantidade":        quantidade,
		})
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("scan preco: %w", err)
	}
	if len(results) == 0 {
		return `{"encontrado": false, "mensagem": "Produto não encontrado."}`, nil
	}
	out := map[string]any{
		"encontrado": true,
		"produtos":   results,
	}
	b, _ := json.Marshal(out)
	return string(b), nil
}

func consultarEstoque(ctx context.Context, argsJSON string) (string, error) {
	var args toolArgs
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return "", fmt.Errorf("invalid args: %w", err)
	}
	term := "%" + strings.ToLower(args.Produto) + "%"
	rows, err := db.Pool.Query(ctx, `
		SELECT p.sku, p.nome, e.quantidade, e.local, e.prazo_reposicao_dias
		FROM produtos p
		LEFT JOIN estoque e ON e.produto_id = p.id
		WHERE lower(p.nome) LIKE $1 OR lower(p.sku) LIKE $1 OR lower(p.descricao) LIKE $1
		LIMIT 5
	`, term)
	if err != nil {
		return "", fmt.Errorf("query estoque: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var sku, nome string
		var quantidade *int
		var local *string
		var prazo *int
		if err := rows.Scan(&sku, &nome, &quantidade, &local, &prazo); err != nil {
			continue
		}
		results = append(results, map[string]any{
			"sku":                  sku,
			"nome":                 nome,
			"quantidade":           quantidade,
			"local":                local,
			"prazo_reposicao_dias": prazo,
		})
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("scan estoque: %w", err)
	}
	if len(results) == 0 {
		return `{"encontrado": false, "mensagem": "Produto não encontrado."}`, nil
	}
	out := map[string]any{
		"encontrado": true,
		"produtos":   results,
	}
	b, _ := json.Marshal(out)
	return string(b), nil
}

func transferirSetor(ctx context.Context, argsJSON string) (string, error) {
	var args toolArgs
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return "", fmt.Errorf("invalid args: %w", err)
	}
	setor := strings.ToLower(strings.TrimSpace(args.Setor))
	var lojaID uuid.UUID
	var lojaNome string
	err := db.Pool.QueryRow(ctx, `SELECT id, nome FROM loja WHERE lower(slug) = $1 OR lower(nome) = $1 LIMIT 1`, setor).Scan(
		&lojaID, &lojaNome)
	if err != nil {
		return `{"sucesso": false, "mensagem": "Setor não encontrado. Use 'vendas' ou 'locacao'."}`, nil
	}
	out := map[string]any{
		"sucesso":   true,
		"loja_id":   lojaID.String(),
		"loja_nome": lojaNome,
		"mensagem":  "Transferência preparada para " + lojaNome,
	}
	b, _ := json.Marshal(out)
	return string(b), nil
}
