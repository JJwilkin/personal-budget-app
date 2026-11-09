import Foundation

/// Talks to the budget server's action endpoint: `POST <base>/actions`
/// with `{ "action": ..., "args": ... }`, answered by `{ "data": ... }` or
/// `{ "error": ... }`. The same endpoint serves the web dashboard, so marks
/// saved here show up there too.
struct APIClient {
    let baseURL: URL
    var session: URLSession = .shared

    func getDashboard() async throws -> Dashboard {
        try await call("getDashboard", EmptyArgs())
    }

    func saveMark(_ args: SaveMarkArgs) async throws {
        let _: OKResponse = try await call("saveMark", args)
    }

    func clearMark(transactionId: String) async throws {
        let _: OKResponse = try await call("clearMark", ClearMarkArgs(transactionId: transactionId))
    }

    func refreshFromPlaid() async throws -> RefreshResult {
        try await call("refreshFromPlaid", EmptyArgs())
    }

    private func call<Args: Encodable, Output: Decodable>(_ action: String, _ args: Args) async throws -> Output {
        var request = URLRequest(url: baseURL.appendingPathComponent("actions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        request.httpBody = try JSONEncoder().encode(ActionRequest(action: action, args: args))

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let envelope = try? JSONDecoder().decode(Envelope<Output>.self, from: data)
        if let message = envelope?.error {
            throw APIError.server(message)
        }
        guard (200..<300).contains(status) else {
            throw APIError.badStatus(status)
        }
        guard let value = envelope?.data else {
            throw APIError.unreadableResponse
        }
        return value
    }
}

enum APIError: LocalizedError {
    case server(String)
    case badStatus(Int)
    case unreadableResponse

    var errorDescription: String? {
        switch self {
        case .server(let message): "The server said: \(message)"
        case .badStatus(let code): "The server answered with status \(code)."
        case .unreadableResponse: "The server's answer wasn't in the expected format."
        }
    }
}

struct SaveMarkArgs: Encodable {
    var transactionId: String
    var markType: MarkType
    var amount: Double
    var note: String

    enum CodingKeys: String, CodingKey {
        case transactionId = "transaction_id"
        case markType = "mark_type"
        case amount, note
    }
}

struct RefreshResult: Decodable {
    var started: Bool
    var taskId: String?
}

private struct EmptyArgs: Encodable {}

private struct ClearMarkArgs: Encodable {
    var transactionId: String
    enum CodingKeys: String, CodingKey { case transactionId = "transaction_id" }
}

private struct OKResponse: Decodable {
    var ok: Bool
}

private struct ActionRequest<Args: Encodable>: Encodable {
    var action: String
    var args: Args
}

private struct Envelope<Value: Decodable>: Decodable {
    var data: Value?
    var error: String?
}
