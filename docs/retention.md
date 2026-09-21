# Retenção e descarte de dados — RideKit

Esta é a rotina técnica inicial. Os prazos abaixo são escolhas operacionais conservadoras para dados temporários, não uma afirmação de prazo legal universal. Antes de publicar a política como definitiva, o responsável pela empresa e a assessoria jurídica devem definir uma matriz para pedidos, documentos fiscais, pagamento, suporte, avaliações, logs e backups.

| Dados | Regra implementada | Destino |
| --- | --- | --- |
| Tokens de redefinição e verificação usados/expirados | 30 dias após expiração | Exclusão |
| Tokens de sessão revogados/expirados | 30 dias após expiração | Exclusão |
| Carrinhos anônimos sem atualização | 30 dias | Exclusão, incluindo itens |
| Histórico de buscas | 90 dias | Exclusão |
| Conta encerrada | Imediato | Acesso e sessões revogados; endereços e carrinhos ligados à conta removidos |
| Pedidos, cobranças, eventos, comprovantes e dados fiscais | Sem descarte automático | Revisão humana da base legal e dos prazos aplicáveis |
| Avaliações, mídias, atendimento, newsletter e backups | Sem descarte automático nesta rotina | Exigem política específica e tratamento dos arquivos/provedores |

Execute `npm run retention:preview` para conferir as quantidades. `npm run retention:apply` executa o descarte dentro de uma transação e registra as quantidades em `retention_runs`. Faça backup antes da primeira execução e programe a execução diária no agendador do ambiente de hospedagem. A aplicação não garante agendamento próprio em ambientes sem processo contínuo.

O encerramento da conta não é uma promessa de exclusão integral. A Política de Privacidade fornecida permite conservação restrita quando houver fundamento aplicável; os detalhes e prazos ainda precisam de aprovação jurídica. Também é necessário preencher razão social, CNPJ, endereço, e-mails e domínio nos textos publicados.
