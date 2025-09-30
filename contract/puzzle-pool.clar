;; Chess Puzzle Pool Smart Contract
;; A betting game where users compete to solve chess puzzles fastest

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-inactive (err u103))
(define-constant err-deadline-passed (err u104))
(define-constant err-deadline-not-passed (err u105))
(define-constant err-already-entered (err u106))
(define-constant err-invalid-stake (err u107))
(define-constant err-no-winner (err u108))
(define-constant err-already-claimed (err u109))
(define-constant err-transfer-failed (err u110))
(define-constant err-invalid-difficulty (err u111))
(define-constant err-not-authorized (err u112))

(define-constant platform-fee-percent u5) ;; 5% platform fee

;; Data Variables
(define-data-var puzzle-nonce uint u0)
(define-data-var platform-address principal contract-owner)

;; Data Maps
(define-map puzzles
    uint
    {
        difficulty: (string-ascii 20),
        prize-pool: uint,
        solution-hash: (buff 32),
        deadline: uint,
        winner: (optional principal),
        is-active: bool,
        entry-count: uint,
        stake-amount: uint
    }
)

(define-map entries
    {puzzle-id: uint, player: principal}
    {
        solve-time: uint,
        timestamp: uint,
        is-correct: bool
    }
)

(define-map user-stats
    principal
    {
        total-entries: uint,
        total-wins: uint,
        total-winnings: uint
    }
)

(define-map user-puzzle-list
    principal
    (list 100 uint)
)

(define-map active-puzzle-list
    uint
    bool
)

;; Stake amounts by difficulty (in microSTX)
(define-map difficulty-stakes
    (string-ascii 20)
    uint
)

;; Private Functions

(define-private (get-stake-for-difficulty (difficulty (string-ascii 20)))
    (default-to u0 (map-get? difficulty-stakes difficulty))
)

(define-private (calculate-platform-fee (amount uint))
    (/ (* amount platform-fee-percent) u100)
)

(define-private (get-user-stat (user principal))
    (default-to 
        {total-entries: u0, total-wins: u0, total-winnings: u0}
        (map-get? user-stats user)
    )
)

(define-private (add-puzzle-to-user-list (user principal) (puzzle-id uint))
    (let
        (
            (current-list (default-to (list) (map-get? user-puzzle-list user)))
        )
        (map-set user-puzzle-list user (unwrap-panic (as-max-len? (append current-list puzzle-id) u100)))
    )
)

(define-private (refund-participant (participant principal) (stake-amount uint))
    (match (as-contract (stx-transfer? stake-amount contract-owner participant))
        success stake-amount
        error stake-amount
    )
)

;; Public Functions

;; Initialize default stake amounts (called by contract owner)
(define-public (set-difficulty-stake (difficulty (string-ascii 20)) (stake-amount uint))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map-set difficulty-stakes difficulty stake-amount))
    )
)

;; Create a new puzzle (admin only)
(define-public (create-puzzle 
    (difficulty (string-ascii 20))
    (solution-hash (buff 32))
    (deadline uint)
)
    (let
        (
            (puzzle-id (+ (var-get puzzle-nonce) u1))
            (stake-amount (get-stake-for-difficulty difficulty))
        )
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (> stake-amount u0) err-invalid-difficulty)
        (asserts! (> deadline block-height) err-deadline-passed)
        
        (map-set puzzles puzzle-id {
            difficulty: difficulty,
            prize-pool: u0,
            solution-hash: solution-hash,
            deadline: deadline,
            winner: none,
            is-active: true,
            entry-count: u0,
            stake-amount: stake-amount
        })
        
        (map-set active-puzzle-list puzzle-id true)
        (var-set puzzle-nonce puzzle-id)
        (ok puzzle-id)
    )
)

;; Enter a puzzle by staking STX
(define-public (enter-puzzle (puzzle-id uint))
    (let
        (
            (puzzle (unwrap! (map-get? puzzles puzzle-id) err-not-found))
            (stake-amount (get stake-amount puzzle))
            (existing-entry (map-get? entries {puzzle-id: puzzle-id, player: tx-sender}))
        )
        (asserts! (get is-active puzzle) err-inactive)
        (asserts! (<= block-height (get deadline puzzle)) err-deadline-passed)
        (asserts! (is-none existing-entry) err-already-entered)
        
        ;; Transfer stake to contract
        (unwrap! (stx-transfer? stake-amount tx-sender (as-contract tx-sender)) err-transfer-failed)
        
        ;; Update puzzle prize pool
        (map-set puzzles puzzle-id (merge puzzle {
            prize-pool: (+ (get prize-pool puzzle) stake-amount),
            entry-count: (+ (get entry-count puzzle) u1)
        }))
        
        ;; Create entry placeholder
        (map-set entries {puzzle-id: puzzle-id, player: tx-sender} {
            solve-time: u0,
            timestamp: block-height,
            is-correct: false
        })
        
        ;; Update user stats
        (let
            (
                (stats (get-user-stat tx-sender))
            )
            (map-set user-stats tx-sender (merge stats {
                total-entries: (+ (get total-entries stats) u1)
            }))
        )
        
        ;; Add to user's puzzle list
        (add-puzzle-to-user-list tx-sender puzzle-id)
        
        (ok true)
    )
)

;; Submit solution with solve time
(define-public (submit-solution 
    (puzzle-id uint)
    (solution (buff 32))
    (solve-time uint)
)
    (let
        (
            (puzzle (unwrap! (map-get? puzzles puzzle-id) err-not-found))
            (entry (unwrap! (map-get? entries {puzzle-id: puzzle-id, player: tx-sender}) err-not-found))
            (is-solution-correct (is-eq solution (get solution-hash puzzle)))
        )
        (asserts! (get is-active puzzle) err-inactive)
        (asserts! (<= block-height (get deadline puzzle)) err-deadline-passed)
        
        ;; Update entry with solve time and correctness
        (map-set entries {puzzle-id: puzzle-id, player: tx-sender} (merge entry {
            solve-time: solve-time,
            is-correct: is-solution-correct
        }))
        
        (ok is-solution-correct)
    )
)

;; Set winner after deadline (admin only)
(define-public (set-winner (puzzle-id uint) (winner-address principal))
    (let
        (
            (puzzle (unwrap! (map-get? puzzles puzzle-id) err-not-found))
            (winner-entry (unwrap! (map-get? entries {puzzle-id: puzzle-id, player: winner-address}) err-not-found))
        )
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (> block-height (get deadline puzzle)) err-deadline-not-passed)
        (asserts! (is-none (get winner puzzle)) err-already-claimed)
        (asserts! (get is-correct winner-entry) err-no-winner)
        
        ;; Set winner
        (map-set puzzles puzzle-id (merge puzzle {
            winner: (some winner-address),
            is-active: false
        }))
        
        (map-delete active-puzzle-list puzzle-id)
        (ok true)
    )
)

;; Claim prize (winner only)
(define-public (claim-prize (puzzle-id uint))
    (let
        (
            (puzzle (unwrap! (map-get? puzzles puzzle-id) err-not-found))
            (winner (unwrap! (get winner puzzle) err-no-winner))
            (prize-pool (get prize-pool puzzle))
        )
        (asserts! (is-eq tx-sender winner) err-not-authorized)
        (asserts! (> block-height (get deadline puzzle)) err-deadline-not-passed)
        (asserts! (> prize-pool u0) err-transfer-failed)
        
        (let
            (
                (platform-fee (calculate-platform-fee prize-pool))
                (winner-amount (- prize-pool platform-fee))
            )
            ;; Transfer winnings to winner
            (unwrap! (as-contract (stx-transfer? winner-amount contract-owner winner)) err-transfer-failed)
            
            ;; Transfer platform fee
            (unwrap! (as-contract (stx-transfer? platform-fee contract-owner (var-get platform-address))) err-transfer-failed)
            
            ;; Update winner stats
            (let
                (
                    (stats (get-user-stat winner))
                )
                (map-set user-stats winner (merge stats {
                    total-wins: (+ (get total-wins stats) u1),
                    total-winnings: (+ (get total-winnings stats) winner-amount)
                }))
            )
            
            ;; Mark puzzle as inactive and clear prize pool
            (map-set puzzles puzzle-id (merge puzzle {
                is-active: false,
                prize-pool: u0
            }))
            (map-delete active-puzzle-list puzzle-id)
            
            (ok winner-amount)
        )
    )
)

;; Emergency refund if no correct solutions (admin only)
(define-public (emergency-refund (puzzle-id uint) (participants (list 100 principal)))
    (let
        (
            (puzzle (unwrap! (map-get? puzzles puzzle-id) err-not-found))
            (stake-amount (get stake-amount puzzle))
        )
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (> block-height (get deadline puzzle)) err-deadline-not-passed)
        (asserts! (is-none (get winner puzzle)) err-already-claimed)
        
        ;; Mark puzzle as inactive first
        (map-set puzzles puzzle-id (merge puzzle {
            is-active: false,
            prize-pool: u0
        }))
        (map-delete active-puzzle-list puzzle-id)
        
        ;; Refund all participants
        (ok (fold refund-participant participants stake-amount))
    )
)

;; Update platform fee address (owner only)
(define-public (update-platform-address (new-address principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (var-set platform-address new-address))
    )
)

;; Read-only Functions

;; Get puzzle info
(define-read-only (get-puzzle-info (puzzle-id uint))
    (ok (unwrap! (map-get? puzzles puzzle-id) err-not-found))
)

;; Get user entry for a puzzle
(define-read-only (get-entry (puzzle-id uint) (player principal))
    (ok (map-get? entries {puzzle-id: puzzle-id, player: player}))
)

;; Get user statistics
(define-read-only (get-user-stats (user principal))
    (ok (get-user-stat user))
)

;; Get all puzzles a user has entered
(define-read-only (get-user-entries (user principal))
    (ok (default-to (list) (map-get? user-puzzle-list user)))
)

;; Get current puzzle nonce (total puzzles created)
(define-read-only (get-puzzle-count)
    (ok (var-get puzzle-nonce))
)

;; Get platform address
(define-read-only (get-platform-address)
    (ok (var-get platform-address))
)

;; Check if puzzle is active
(define-read-only (is-puzzle-active (puzzle-id uint))
    (ok (default-to false (map-get? active-puzzle-list puzzle-id)))
)

;; Get stake amount for difficulty
(define-read-only (get-difficulty-stake-amount (difficulty (string-ascii 20)))
    (ok (get-stake-for-difficulty difficulty))
)
