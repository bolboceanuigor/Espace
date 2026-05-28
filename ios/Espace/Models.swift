import Foundation

struct APIEnvelope<T: Decodable>: Decodable {
    let data: T?
    let error: APIErrorPayload?
    let message: String?
}

struct APIErrorPayload: Decodable {
    let code: String?
    let message: String?
}

struct AuthPayload: Codable, Equatable {
    let accessToken: String
    let user: EspaceUser
}

struct MePayload: Decodable {
    let user: EspaceUser
}

struct EspaceUser: Codable, Equatable, Identifiable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let role: String
    let organizationId: String?
    let preferredLanguage: String?

    var displayName: String {
        [firstName, lastName]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
            .nonEmpty ?? email
    }
}

struct AssociationSummary: Decodable, Identifiable, Equatable {
    let id: String?
    let shortName: String?
    let legalName: String?
    let associationCode: String?

    var displayName: String { shortName?.nonEmpty ?? legalName?.nonEmpty ?? "A.P.C." }
}

struct ApartmentSummary: Decodable, Identifiable, Equatable {
    let id: String
    let number: String?
    let apartmentNumber: String?
    let staircase: String?
    let building: String?
    let floor: Int?

    var displayName: String {
        let value = number?.nonEmpty ?? apartmentNumber?.nonEmpty ?? "-"
        return "Ap. \(value)"
    }
}

struct ResidentHome: Decodable, Equatable {
    let organization: AssociationSummary?
    let apartments: [ApartmentSummary]?
    let primaryApartment: ApartmentSummary?
    let finance: HomeFinance?
    let meters: HomeMeters?
    let issues: HomeIssues?
    let announcements: HomeAnnouncements?
    let emptyStateMessage: String?
}

struct HomeFinance: Decodable, Equatable {
    let totalDebt: Double?
    let unpaidInvoicesCount: Int?
    let overdueInvoicesCount: Int?
    let nextDueDate: String?
    let lastPaymentDate: String?
    let status: String?
}

struct HomeMeters: Decodable, Equatable {
    let total: Int?
    let missingReadings: Int?
    let latest: [ResidentMeter]?
}

struct HomeIssues: Decodable, Equatable {
    let activeCount: Int?
    let latest: [ResidentIssue]?
}

struct HomeAnnouncements: Decodable, Equatable {
    let latest: [Announcement]?
}

struct PageMeta: Decodable, Equatable {
    let page: Int?
    let limit: Int?
    let total: Int?
}

struct PaginatedResponse<T: Decodable & Equatable>: Decodable, Equatable {
    let items: [T]
    let meta: PageMeta?
}

struct ResidentInvoice: Decodable, Identifiable, Equatable {
    let id: String
    let invoiceNumber: String?
    let billingMonth: String?
    let apartment: ApartmentReference?
    let status: String?
    let currency: String?
    let totalAmount: Double?
    let paidAmount: Double?
    let balanceAmount: Double?
    let issueDate: String?
    let dueDate: String?
    let isOverdue: Bool?
}

struct ApartmentReference: Decodable, Equatable {
    let id: String?
    let number: String?

    var displayName: String {
        number?.nonEmpty.map { "Ap. \($0)" } ?? "Apartament"
    }

    init(from decoder: Decoder) throws {
        if let value = try? decoder.singleValueContainer().decode(String.self) {
            id = nil
            number = value
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        number = try container.decodeIfPresent(String.self, forKey: .number)
            ?? container.decodeIfPresent(String.self, forKey: .apartmentNumber)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case number
        case apartmentNumber
    }
}

struct ResidentMeter: Decodable, Identifiable, Equatable {
    let id: String
    let apartmentNumber: String?
    let type: String?
    let serialNumber: String?
    let status: String?
    let lastReading: MeterReading?
}

struct MeterReading: Decodable, Identifiable, Equatable {
    let id: String?
    let value: Double?
    let readingDate: String?
    let createdAt: String?
}

struct ResidentIssue: Decodable, Identifiable, Equatable {
    let id: String
    let apartmentNumber: String?
    let title: String
    let description: String?
    let preview: String?
    let category: String?
    let priority: String?
    let status: String?
    let createdAt: String?
}

struct Announcement: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let content: String?
    let preview: String?
    let category: String?
    let createdAt: String?
}

struct CreateIssueBody: Encodable {
    let title: String
    let description: String
    let category: String
    let priority: String
    let apartmentId: String?
}

extension String {
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
